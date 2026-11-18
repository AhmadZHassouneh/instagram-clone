import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../db/migrate.mjs";
import { decideLink, deleteImport, getImport, runMatching, saveImport, setNote, toCsv, txnStatus } from "../../src/lib/reconcile/store";
import { planBusinessSeed, type SeedOptions } from "../../src/lib/seed/business/plan";
import { statementFromPlan } from "../../src/lib/seed/business/statement";
import { writeSeedPlan } from "../../src/lib/seed/business/write";
import { parseBlinkStatement } from "../../src/lib/statements/blink";
import { formatFils } from "../../src/lib/statements/money";
import { rowsFrom } from "../statements/builder";
import { renderStatementPdf } from "../statements/render-pdf";

// Everything here is synthetic (Phase 2 seed + statement).

/** Hash of every table reconciliation must never modify. */
function protectedSnapshot(db: DatabaseSync) {
  const h = crypto.createHash("sha256");
  for (const table of ["orders", "order_items", "invoices", "invoice_items", "messages", "conversations", "users"]) {
    h.update(table + JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
  }
  return h.digest("hex");
}

async function setup(seed: number) {
  const db = openDatabase(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sg-rec-")), "test.db"));
  const ownerId = Number(
    db.prepare("INSERT INTO users (username, email, name, password_hash, created_at) VALUES ('owner', 'o@x.test', 'Owner', 'x', 1)").run().lastInsertRowid,
  );
  const options: SeedOptions = {
    businesses: 8,
    conversationsPerBusiness: 2,
    from: Date.parse("2026-05-01T09:00:00+03:00"),
    to: Date.parse("2026-09-30T21:00:00+03:00"),
    seed,
    ownerName: "سامي",
  };
  const plan = planBusinessSeed(options);
  const written = writeSeedPlan(db, plan, "owner");
  const st = statementFromPlan(plan, seed);
  const pdf = await renderStatementPdf({
    holder: st.holder,
    account: st.account,
    periodFrom: st.entries[0].date,
    periodTo: st.entries.at(-1)!.date,
    rows: rowsFrom(st.openingFils, st.entries),
  });
  const parsed = await parseBlinkStatement(pdf);
  expect(parsed.validation.ok).toBe(true);

  // invoice key -> order id, to translate the expected answers.
  const orderOfInvoice = new Map<string, number>();
  for (const [key, inv] of written.invoices_by_key) {
    const r = db.prepare("SELECT order_id FROM invoices WHERE id = ?").get(inv.id) as { order_id: number };
    orderOfInvoice.set(key, r.order_id);
  }
  return { db, ownerId, st, pdf, parsed, orderOfInvoice };
}

describe("reconciliation end to end (synthetic data)", () => {
  for (const seed of [42, 7, 2026]) {
    it(`links seeded payments to the right orders without touching them (seed ${seed})`, async () => {
      const { db, ownerId, st, pdf, parsed, orderOfInvoice } = await setup(seed);
      const before = protectedSnapshot(db);

      const { importId } = saveImport(db, ownerId, "synthetic.pdf", pdf, parsed);
      runMatching(db, ownerId, importId);
      const view = getImport(db, ownerId, importId);

      expect(protectedSnapshot(db)).toBe(before); // orders, invoices, messages untouched

      let correct = 0;
      let paymentRows = 0;
      for (const e of st.expected) {
        const t = view.transactions[e.index - 1];
        const linkedOrders = t.links.map((l) => l.orderId).sort();
        if (e.kind === "payment") {
          paymentRows++;
          const want = [...new Set(e.invoiceKeys.map((k) => orderOfInvoice.get(k)!))].sort();
          if (JSON.stringify(linkedOrders) === JSON.stringify(want)) correct++;
          // Precision: an auto-match is never wrong.
          if (t.links.some((l) => l.level === "auto")) expect(linkedOrders, `row ${e.index}`).toEqual(want);
        } else {
          // Noise and near-misses must not be auto-matched to anything.
          expect(t.links.filter((l) => l.level === "auto"), `${e.kind} row ${e.index}`).toEqual([]);
        }
      }
      // Recall: nearly every real payment is linked (auto or suggested) to exactly the right orders.
      expect(correct / paymentRows).toBeGreaterThanOrEqual(0.9);
      // Every auto/suggested link covers a statement row with the right direction.
      for (const t of view.transactions) for (const l of t.links) expect(l.order.direction).toBe(t.direction);
    });
  }

  it("supports confirm/reject/notes, never re-proposes rejected pairs, and exports CSV", async () => {
    const { db, ownerId, pdf, parsed } = await setup(42);
    const { importId } = saveImport(db, ownerId, "synthetic.pdf", pdf, parsed);
    expect(saveImport(db, ownerId, "again.pdf", pdf, parsed)).toEqual({ importId, existing: true });
    runMatching(db, ownerId, importId);
    const stranger = Number(db.prepare("INSERT INTO users (username, email, name, password_hash, created_at) VALUES ('x', 'x@x.test', 'X', 'x', 1)").run().lastInsertRowid);
    const before = protectedSnapshot(db);

    let view = getImport(db, ownerId, importId);
    const linked = view.transactions.filter((t) => t.links.length);
    const [toConfirm, toReject] = linked;
    decideLink(db, ownerId, toConfirm.links[0].id, "confirmed");
    decideLink(db, ownerId, toReject.links[0].id, "rejected");
    const unmatched = view.transactions.find((t) => !t.links.length && t.type === "transfer")!;
    setNote(db, ownerId, unmatched.id, "تحويل من صديق — مش إلها علاقة بالشغل");

    // Re-running matching keeps decisions and doesn't bring the rejected pair back.
    runMatching(db, ownerId, importId);
    view = getImport(db, ownerId, importId);
    const c = view.transactions.find((t) => t.id === toConfirm.id)!;
    expect(c.links[0]).toMatchObject({ status: "confirmed", confirmedBy: "owner" });
    expect(c.links[0].confirmedAt).toBeGreaterThan(0);
    expect(txnStatus(c)).toBe("confirmed");
    const r = view.transactions.find((t) => t.id === toReject.id)!;
    expect(r.links.filter((l) => l.orderId === toReject.links[0].orderId).map((l) => l.status)).toEqual(["rejected"]);
    expect(view.transactions.find((t) => t.id === unmatched.id)!.note).toContain("صديق");

    // Another user can't see or change this import.
    expect(() => getImport(db, stranger, importId)).toThrow();
    expect(() => decideLink(db, stranger, toConfirm.links[0].id, "rejected")).toThrow();
    expect(() => setNote(db, stranger, unmatched.id, "x")).toThrow();

    const csv = toCsv(view, formatFils);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(view.transactions.length + 1);
    expect(lines[0]).toContain('"Linked order IDs"');
    expect(csv).toContain("صديق");
    expect(csv).toContain(`"${toConfirm.links[0].orderId}"`);

    expect(protectedSnapshot(db)).toBe(before);
    deleteImport(db, ownerId, importId);
    expect((db.prepare("SELECT COUNT(*) AS n FROM reconciliation_links").get() as { n: number }).n).toBe(0);
    expect(protectedSnapshot(db)).toBe(before);
  });
});
