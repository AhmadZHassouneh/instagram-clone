// Writes a SeedPlan into the database. Every row it creates has is_seed = 1, and nothing that
// already exists is modified except the owner's conversation membership rows in seed threads.
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SeedPlan } from "./plan";

export type WriteResult = {
  users: number;
  conversations: number;
  messages: number;
  orders: number;
  invoices: number;
  /** plan invoice key -> saved invoice */
  invoices_by_key: Map<string, { id: number; number: string }>;
};

export function writeSeedPlan(db: DatabaseSync, plan: SeedPlan, ownerUsername: string): WriteResult {
  const owner = db.prepare("SELECT id FROM users WHERE username = ?").get(ownerUsername) as { id: number } | undefined;
  if (!owner) throw new Error(`Owner account "${ownerUsername}" not found. Pass --owner <username>.`);

  const run = (sql: string, ...p: SQLInputValue[]) => Number(db.prepare(sql).run(...p).lastInsertRowid);
  const result: WriteResult = { users: 0, conversations: 0, messages: 0, orders: 0, invoices: 0, invoices_by_key: new Map() };

  // Continue invoice numbering after whatever exists already (seeded or real).
  const nextNumber = (() => {
    const counters = new Map<string, number>();
    return (prefix: string, year: number) => {
      const key = `${prefix}-${year}`;
      if (!counters.has(key)) {
        const rows = db.prepare("SELECT number FROM invoices WHERE number LIKE ?").all(`${key}-%`) as { number: string }[];
        counters.set(key, rows.reduce((m, r) => Math.max(m, Number(r.number.split("-").at(-1)) || 0), 0));
      }
      const n = counters.get(key)! + 1;
      counters.set(key, n);
      return `${key}-${String(n).padStart(4, "0")}`;
    };
  })();

  db.exec("BEGIN");
  try {
    for (const thread of plan.threads) {
      const b = thread.business;
      let bizId = (db.prepare("SELECT id, is_seed FROM users WHERE username = ?").get(b.username) as { id: number; is_seed: number } | undefined);
      if (bizId && !bizId.is_seed) throw new Error(`A real account already uses the username "${b.username}"; not touching it.`);
      if (!bizId) {
        const id = run(
          `INSERT INTO users (username, email, name, password_hash, bio, avatar, is_business, business_category, is_seed, created_at)
           VALUES (?, ?, ?, '!', ?, ?, 1, ?, 1, ?)`,
          b.username,
          `${b.username}@example.invalid`,
          b.name,
          `${b.nameArabic}\n(Demo business — test data)`,
          `https://picsum.photos/seed/${b.username}/300/300`,
          b.category,
          plan.options.from,
        );
        bizId = { id, is_seed: 1 };
        result.users++;
      }
      const party = (who: "owner" | "biz") => (who === "owner" ? owner.id : bizId!.id);

      const first = thread.messages[0]?.at ?? plan.options.from;
      const last = thread.messages.at(-1)?.at ?? first;
      const convId = run("INSERT INTO conversations (created_at, updated_at, is_seed) VALUES (?, ?, 1)", first, last);
      run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)", convId, owner.id, convId, bizId.id);
      result.conversations++;

      // Invoices and orders
      for (const inv of thread.invoices) {
        const issued = new Date(inv.issuedAt);
        const number = nextNumber(inv.kind === "invoice" ? "INV" : "RCPT", issued.getUTCFullYear());
        const issuer = party(inv.issuer);
        const recipient = issuer === owner.id ? bizId.id : owner.id;
        const id = run(
          `INSERT INTO invoices (number, kind, issuer_id, recipient_id, issued_at, total_fils, currency, payment_method, payment_reference, paid_at, is_seed)
           VALUES (?, ?, ?, ?, ?, ?, 'JOD', 'CliQ', ?, ?, 1)`,
          number,
          inv.kind,
          issuer,
          recipient,
          inv.issuedAt,
          inv.totalFils,
          inv.paymentReference,
          inv.paidAt,
        );
        inv.items.forEach((it, i) =>
          run("INSERT INTO invoice_items (invoice_id, description, quantity, unit_fils, position) VALUES (?, ?, ?, ?, ?)", id, it.description, it.quantity, it.unitFils, i),
        );
        result.invoices_by_key.set(inv.key, { id, number });
        result.invoices++;
      }
      for (const o of thread.orders) {
        const seller = party(o.seller);
        const buyer = seller === owner.id ? bizId.id : owner.id;
        const id = run(
          `INSERT INTO orders (seller_id, buyer_id, conversation_id, title, status, total_fils, created_at, updated_at, is_seed)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          seller,
          buyer,
          convId,
          o.title,
          o.status,
          o.totalFils,
          o.createdAt,
          o.updatedAt,
        );
        o.items.forEach((it, i) =>
          run("INSERT INTO order_items (order_id, description, quantity, unit_fils, position) VALUES (?, ?, ?, ?, ?)", id, it.description, it.quantity, it.unitFils, i),
        );
        const inv = result.invoices_by_key.get(o.invoiceKey);
        if (inv) db.prepare("UPDATE invoices SET order_id = ? WHERE id = ?").run(id, inv.id);
        result.orders++;
      }

      // Messages + read receipts
      let lastOwnerMsg = 0;
      let lastBizMsg = 0;
      const ids: { id: number; from: "owner" | "biz" }[] = [];
      for (const m of thread.messages) {
        const id = run(
          `INSERT INTO messages (conversation_id, sender_id, kind, text, invoice_id, voice_seconds, created_at, is_seed)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          convId,
          party(m.from),
          m.kind,
          m.text,
          m.invoiceKey ? (result.invoices_by_key.get(m.invoiceKey)?.id ?? null) : null,
          m.voiceSeconds,
          m.at,
        );
        ids.push({ id, from: m.from });
        if (m.from === "owner") lastOwnerMsg = id;
        else lastBizMsg = id;
        result.messages++;
      }
      const lastId = ids.at(-1)?.id ?? 0;
      // Owner has read everything, or everything except the business's trailing messages.
      const ownerRead = thread.ownerReadAll ? lastId : Math.max(lastOwnerMsg, (ids.findLast((x) => x.from === "owner")?.id ?? 0));
      // Business has seen everything, or not the owner's last message(s).
      const bizRead = thread.bizReadAll ? lastId : Math.max(lastBizMsg, (ids.findLast((x) => x.from === "biz")?.id ?? 0));
      db.prepare("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?").run(ownerRead, convId, owner.id);
      db.prepare("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?").run(bizRead, convId, bizId.id);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return result;
}

/** Deletes every seeded row. Real data (is_seed = 0) is never touched. */
export function deleteSeedData(db: DatabaseSync) {
  const counts: Record<string, number> = {};
  const del = (table: string, sql: string) => {
    counts[table] = Number(db.prepare(sql).run().changes);
  };
  db.exec("BEGIN");
  try {
    del("messages", "DELETE FROM messages WHERE is_seed = 1");
    del("invoices", "DELETE FROM invoices WHERE is_seed = 1"); // invoice_items cascade
    del("orders", "DELETE FROM orders WHERE is_seed = 1"); // order_items cascade
    del("conversations", "DELETE FROM conversations WHERE is_seed = 1"); // members cascade
    del("users", "DELETE FROM users WHERE is_seed = 1");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return counts;
}
