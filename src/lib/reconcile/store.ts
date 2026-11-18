// Database side of reconciliation. Writes ONLY to statement_imports, statement_transactions and
// reconciliation_links. Orders, invoices, messages and users are read, never modified.
import crypto from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { ParsedStatement } from "../statements/blink/types";
import { maskAccount } from "../statements/mask";
import { matchTransactions, type MatchOptions, type MatchOrder, type MatchTxn } from "./match";
import { txnStatus, type ImportView } from "./types";

export type * from "./types";
export { txnStatus };

const rows = <T>(db: DatabaseSync, sql: string, ...p: SQLInputValue[]) => db.prepare(sql).all(...p) as T[];
const row = <T>(db: DatabaseSync, sql: string, ...p: SQLInputValue[]) => db.prepare(sql).get(...p) as T | undefined;

export class NotFound extends Error {}

/** Saves a parsed statement. Re-importing the same file returns the existing import. */
export function saveImport(db: DatabaseSync, userId: number, fileName: string, pdf: Uint8Array, parsed: ParsedStatement) {
  const hash = crypto.createHash("sha256").update(pdf).digest("hex");
  const existing = row<{ id: number }>(db, "SELECT id FROM statement_imports WHERE user_id = ? AND file_hash = ?", userId, hash);
  if (existing) return { importId: existing.id, existing: true };

  db.exec("BEGIN");
  try {
    const importId = Number(
      db
        .prepare(
          `INSERT INTO statement_imports (user_id, file_name, file_hash, account_masked, period_from, period_to,
             opening_fils, closing_fils, validation_ok, validation_json, imported_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          fileName.slice(0, 200),
          hash,
          maskAccount(parsed.header.accountNumber),
          parsed.header.periodFrom,
          parsed.header.periodTo,
          parsed.openingBalanceFils,
          parsed.closingBalanceFils,
          parsed.validation.ok ? 1 : 0,
          JSON.stringify(parsed.validation),
          Date.now(),
        ).lastInsertRowid,
    );
    const ins = db.prepare(
      `INSERT INTO statement_transactions (import_id, idx, page, date, direction, type, counterparty, cliq_reference,
         description, amount_fils, balance_fils) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const t of parsed.transactions) {
      ins.run(importId, t.index, t.page, t.date, t.direction, t.type, t.counterparty, t.cliqReference, t.description, t.amountFils, t.balanceFils);
    }
    db.exec("COMMIT");
    return { importId, existing: false };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function ownImport(db: DatabaseSync, userId: number, importId: number) {
  const imp = row<{ id: number }>(db, "SELECT id FROM statement_imports WHERE id = ? AND user_id = ?", importId, userId);
  if (!imp) throw new NotFound("Statement not found.");
}

/** The user's orders as matching candidates, with what is still unaccounted for. */
export function loadOrders(db: DatabaseSync, userId: number): MatchOrder[] {
  const orders = rows<{
    id: number;
    seller_id: number;
    buyer_id: number;
    total_fils: number;
    created_at: number;
    updated_at: number;
    linked: number;
    other_id: number;
    other_name: string;
    other_username: string;
    other_bio: string;
  }>(
    db,
    `SELECT o.id, o.seller_id, o.buyer_id, o.total_fils, o.created_at, o.updated_at,
       COALESCE((SELECT SUM(amount_fils) FROM reconciliation_links WHERE order_id = o.id AND status != 'rejected'), 0) AS linked,
       u.id AS other_id, u.name AS other_name, u.username AS other_username, u.bio AS other_bio
     FROM orders o JOIN users u ON u.id = CASE WHEN o.seller_id = ? THEN o.buyer_id ELSE o.seller_id END
     WHERE (o.seller_id = ? OR o.buyer_id = ?) AND o.status != 'cancelled'`,
    userId,
    userId,
    userId,
  );
  const invoices = rows<{ order_id: number; issued_at: number; paid_at: number | null; payment_reference: string }>(
    db,
    `SELECT order_id, issued_at, paid_at, payment_reference FROM invoices
     WHERE order_id IN (SELECT id FROM orders WHERE seller_id = ? OR buyer_id = ?)`,
    userId,
    userId,
  );
  return orders.map((o) => {
    const inv = invoices.filter((i) => i.order_id === o.id);
    return {
      id: o.id,
      direction: o.seller_id === userId ? "in" : "out",
      partyId: o.other_id,
      remainingFils: o.total_fils - o.linked,
      dates: [o.created_at, o.updated_at, ...inv.flatMap((i) => [i.issued_at, ...(i.paid_at ? [i.paid_at] : [])])],
      names: [o.other_name, o.other_username, o.other_bio.split("\n")[0]].filter(Boolean),
      references: inv.map((i) => i.payment_reference).filter(Boolean),
    } satisfies MatchOrder;
  });
}

/**
 * Proposes links for this import's transactions that don't have an active link yet.
 * Existing links (pending/confirmed) are kept; rejected pairs are never proposed again.
 */
export function runMatching(db: DatabaseSync, userId: number, importId: number, options: Partial<MatchOptions> = {}) {
  ownImport(db, userId, importId);
  const txns = rows<{ id: number; date: string; direction: "in" | "out"; type: string; amount_fils: number; counterparty: string | null; cliq_reference: string | null }>(
    db,
    `SELECT t.id, t.date, t.direction, t.type, t.amount_fils, t.counterparty, t.cliq_reference FROM statement_transactions t
     WHERE t.import_id = ? AND NOT EXISTS (SELECT 1 FROM reconciliation_links l WHERE l.transaction_id = t.id AND l.status != 'rejected')`,
    importId,
  ).map(
    (t): MatchTxn => ({ id: t.id, date: t.date, direction: t.direction, type: t.type, amountFils: t.amount_fils, counterparty: t.counterparty, cliqReference: t.cliq_reference }),
  );
  const rejected = new Set(
    rows<{ k: string }>(
      db,
      `SELECT l.transaction_id || ':' || l.order_id AS k FROM reconciliation_links l
       JOIN statement_transactions t ON t.id = l.transaction_id WHERE t.import_id = ? AND l.status = 'rejected'`,
      importId,
    ).map((r) => r.k),
  );
  const links = matchTransactions(txns, loadOrders(db, userId), { ...options, rejected });

  const now = Date.now();
  // A rejected pair is never re-proposed (filtered above), so plain INSERT can't hit the UNIQUE key.
  const ins = db.prepare(
    `INSERT INTO reconciliation_links (transaction_id, order_id, amount_fils, confidence, level, status, reasons, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  );
  db.exec("BEGIN");
  try {
    for (const l of links) ins.run(l.transactionId, l.orderId, l.amountFils, l.confidence, l.level, l.reasons.join("; "), now);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { proposed: links.length, auto: links.filter((l) => l.level === "auto").length };
}

export function listImports(db: DatabaseSync, userId: number) {
  return rows<{ id: number; file_name: string; account_masked: string; period_from: string | null; period_to: string | null; validation_ok: number; imported_at: number; txns: number; linked: number }>(
    db,
    `SELECT i.id, i.file_name, i.account_masked, i.period_from, i.period_to, i.validation_ok, i.imported_at,
       (SELECT COUNT(*) FROM statement_transactions WHERE import_id = i.id) AS txns,
       (SELECT COUNT(DISTINCT l.transaction_id) FROM reconciliation_links l JOIN statement_transactions t ON t.id = l.transaction_id
        WHERE t.import_id = i.id AND l.status != 'rejected') AS linked
     FROM statement_imports i WHERE i.user_id = ? ORDER BY i.id DESC`,
    userId,
  ).map((r) => ({
    id: r.id,
    fileName: r.file_name,
    accountMasked: r.account_masked,
    periodFrom: r.period_from,
    periodTo: r.period_to,
    validationOk: !!r.validation_ok,
    importedAt: r.imported_at,
    transactions: r.txns,
    linked: r.linked,
  }));
}

export function getImport(db: DatabaseSync, userId: number, importId: number): ImportView {
  const imp = row<{
    id: number;
    file_name: string;
    account_masked: string;
    period_from: string | null;
    period_to: string | null;
    opening_fils: number | null;
    closing_fils: number | null;
    validation_ok: number;
    validation_json: string;
    imported_at: number;
  }>(db, "SELECT * FROM statement_imports WHERE id = ? AND user_id = ?", importId, userId);
  if (!imp) throw new NotFound("Statement not found.");

  const txns = rows<{ id: number; idx: number; page: number; date: string; direction: "in" | "out"; type: string; counterparty: string | null; cliq_reference: string | null; description: string; amount_fils: number; balance_fils: number; note: string }>(
    db,
    "SELECT * FROM statement_transactions WHERE import_id = ? ORDER BY idx",
    importId,
  );
  const links = rows<{
    id: number;
    transaction_id: number;
    order_id: number;
    amount_fils: number;
    confidence: number;
    level: "auto" | "suggested";
    status: "pending" | "confirmed" | "rejected";
    reasons: string;
    confirmed_by_name: string | null;
    confirmed_at: number | null;
    title: string;
    total_fils: number;
    order_status: string;
    order_created: number;
    seller_id: number;
    conversation_id: number | null;
    party_name: string;
    party_username: string;
    invoice_numbers: string | null;
  }>(
    db,
    `SELECT l.*, cu.username AS confirmed_by_name, o.title, o.total_fils, o.status AS order_status, o.created_at AS order_created,
       o.seller_id, o.conversation_id, p.name AS party_name, p.username AS party_username,
       (SELECT GROUP_CONCAT(number, ', ') FROM invoices WHERE order_id = o.id) AS invoice_numbers
     FROM reconciliation_links l
     JOIN statement_transactions t ON t.id = l.transaction_id
     JOIN orders o ON o.id = l.order_id
     JOIN users p ON p.id = CASE WHEN o.seller_id = ? THEN o.buyer_id ELSE o.seller_id END
     LEFT JOIN users cu ON cu.id = l.confirmed_by
     WHERE t.import_id = ?
     ORDER BY l.confidence DESC`,
    userId,
    importId,
  );

  return {
    id: imp.id,
    fileName: imp.file_name,
    accountMasked: imp.account_masked,
    periodFrom: imp.period_from,
    periodTo: imp.period_to,
    openingFils: imp.opening_fils,
    closingFils: imp.closing_fils,
    validationOk: !!imp.validation_ok,
    validation: JSON.parse(imp.validation_json),
    importedAt: imp.imported_at,
    transactions: txns.map((t) => ({
      id: t.id,
      idx: t.idx,
      page: t.page,
      date: t.date,
      direction: t.direction,
      type: t.type,
      counterparty: t.counterparty,
      cliqReference: t.cliq_reference,
      description: t.description,
      amountFils: t.amount_fils,
      balanceFils: t.balance_fils,
      note: t.note,
      links: links
        .filter((l) => l.transaction_id === t.id)
        .map((l) => ({
          id: l.id,
          orderId: l.order_id,
          amountFils: l.amount_fils,
          confidence: l.confidence,
          level: l.level,
          status: l.status,
          reasons: l.reasons,
          confirmedBy: l.confirmed_by_name,
          confirmedAt: l.confirmed_at,
          order: {
            title: l.title,
            totalFils: l.total_fils,
            status: l.order_status,
            createdAt: l.order_created,
            direction: l.seller_id === userId ? "in" : "out",
            party: { name: l.party_name, username: l.party_username },
            invoiceNumbers: l.invoice_numbers ? l.invoice_numbers.split(", ") : [],
            conversationId: l.conversation_id,
          },
        })),
    })),
  };
}

/** Confirm, reject, or reset (pending) one link. Records who decided and when. */
export function decideLink(db: DatabaseSync, userId: number, linkId: number, decision: "confirmed" | "rejected" | "pending") {
  const ok = row<{ id: number }>(
    db,
    `SELECT l.id FROM reconciliation_links l JOIN statement_transactions t ON t.id = l.transaction_id
     JOIN statement_imports i ON i.id = t.import_id WHERE l.id = ? AND i.user_id = ?`,
    linkId,
    userId,
  );
  if (!ok) throw new NotFound("Link not found.");
  const decided = decision !== "pending";
  db.prepare("UPDATE reconciliation_links SET status = ?, confirmed_by = ?, confirmed_at = ? WHERE id = ?").run(
    decision,
    decided ? userId : null,
    decided ? Date.now() : null,
    linkId,
  );
}

/** The user's own free-text note on a transaction. */
export function setNote(db: DatabaseSync, userId: number, transactionId: number, note: string) {
  const { changes } = db
    .prepare(
      `UPDATE statement_transactions SET note = ? WHERE id = ?
       AND import_id IN (SELECT id FROM statement_imports WHERE user_id = ?)`,
    )
    .run(note.slice(0, 1000), transactionId, userId);
  if (!changes) throw new NotFound("Transaction not found.");
}

export function deleteImport(db: DatabaseSync, userId: number, importId: number) {
  const { changes } = db.prepare("DELETE FROM statement_imports WHERE id = ? AND user_id = ?").run(importId, userId);
  if (!changes) throw new NotFound("Statement not found.");
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything and neutralise spreadsheet formulas (=, +, -, @ at the start).
  return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
};

export function toCsv(view: ImportView, formatFils: (f: number) => string) {
  const header = ["#", "Date", "Direction", "Type", "Counterparty", "CliQ reference", "Amount (JOD)", "Balance (JOD)", "Status", "Linked order IDs", "Invoices", "Confidence", "Confirmed by", "Confirmed at", "Note"];
  const lines = [header.map(csvCell).join(",")];
  for (const t of view.transactions) {
    const active = t.links.filter((l) => l.status !== "rejected");
    lines.push(
      [
        t.idx,
        t.date,
        t.direction,
        t.type,
        t.counterparty,
        t.cliqReference,
        formatFils(t.amountFils),
        formatFils(t.balanceFils),
        txnStatus(t),
        active.map((l) => l.orderId).join(" "),
        active.flatMap((l) => l.order.invoiceNumbers).join(" "),
        active.length ? Math.max(...active.map((l) => l.confidence)).toFixed(2) : "",
        active.find((l) => l.confirmedBy)?.confirmedBy ?? "",
        active.find((l) => l.confirmedAt)?.confirmedAt ? new Date(active.find((l) => l.confirmedAt)!.confirmedAt!).toISOString() : "",
        t.note,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM so Excel opens Arabic text correctly
}
