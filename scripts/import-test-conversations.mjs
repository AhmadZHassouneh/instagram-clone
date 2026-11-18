// Imports mock conversations (samples/test-conversations.json format) into the app as test data.
// Usage: node scripts/import-test-conversations.mjs [file] [--owner a7mad] [--replace]
// Every row it creates has is_seed = 1, so `npm run seed:business:clean` removes it again.
// Message timestamps are Amman local time. A payment message names the invoice it pays with `payment_for`;
// whoever sends that payment is the buyer, and the invoice (a message with `invoice`) comes from the payer.
// Invoices are saved as records only; they aren't posted as cards in the chat.
// --replace re-imports conversations that already exist (their messages, orders and invoices are replaced).
import fs from "node:fs";
import { openDatabase } from "../db/migrate.mjs";
import { ensureWelcomeMessages } from "../db/welcome.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--owner") ?? "samples/test-conversations.json";
const ownerUsername = flag("owner", "a7mad");
const replace = args.includes("--replace");
const OWNER_SENDER = "أحمد";

const at = (s) => Date.parse(`${s}+03:00`);
const fils = (jd) => Math.round(jd * 1000);
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

// ---- Validate the whole file before touching the database
const { conversations } = JSON.parse(fs.readFileSync(file, "utf8"));
for (const c of conversations) {
  const where = c.contact_name;
  if (!c.is_test_data) fail(`${where}: only test data (is_test_data: true) can be imported`);
  let prev = 0;
  for (const m of c.messages) {
    const t = at(m.timestamp);
    if (Number.isNaN(t)) fail(`${where}: bad timestamp ${m.timestamp}`);
    if (t <= prev) fail(`${where}: ${m.timestamp} is not after the previous message`);
    if (t > Date.now()) fail(`${where}: ${m.timestamp} is in the future`);
    if (m.sender !== OWNER_SENDER && m.sender !== c.contact_name) fail(`${where}: unknown sender ${m.sender}`);
    prev = t;
  }
  const invoices = c.messages.filter((m) => m.invoice);
  const totals = new Map(invoices.map((m) => [m.invoice.key, m.invoice.items.reduce((s, i) => s + fils(i.unit_price) * i.quantity, 0)]));
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  if (sum !== fils(c.total_paid)) fail(`${where}: invoices add up to ${sum / 1000}, total_paid is ${c.total_paid}`);
  for (const key of totals.keys()) {
    const pays = c.messages.filter((m) => m.payment_for === key);
    if (pays.length !== 1) fail(`${where}: invoice ${key} needs exactly one payment message`);
    const card = invoices.find((m) => m.invoice.key === key);
    if (card.sender !== pays[0].sender) fail(`${where}: invoice ${key} must be sent by the payer (${pays[0].sender})`);
    const said = (pays[0].text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => fils(Number(n.replace(/,/g, ""))));
    if (!said.includes(totals.get(key))) fail(`${where}: payment for ${key} doesn't state ${totals.get(key) / 1000}`);
  }
}

// ---- Import
const db = openDatabase();
const owner = db.prepare("SELECT id FROM users WHERE username = ?").get(ownerUsername);
if (!owner) fail(`Owner account "${ownerUsername}" not found.`);
const run = (sql, ...p) => Number(db.prepare(sql).run(...p).lastInsertRowid);
const nextRef = () => {
  const n = db.prepare("SELECT MAX(CAST(SUBSTR(payment_reference, 10) AS INTEGER)) AS n FROM invoices WHERE payment_reference LIKE 'TEST-REF-%'").get().n ?? 0;
  return `TEST-REF-${String(n + 1).padStart(4, "0")}`;
};

let imported = 0;
db.exec("BEGIN");
try {
  for (const c of conversations) {
    let contact = db.prepare("SELECT id FROM users WHERE username = ?").get(c.contact_username)?.id;
    const existing = contact && db.prepare(
      `SELECT a.conversation_id AS id FROM conversation_members a JOIN conversation_members b ON a.conversation_id = b.conversation_id
       WHERE a.user_id = ? AND b.user_id = ?`,
    ).get(owner.id, contact);
    if (existing && !replace) {
      console.log(`skip ${c.contact_name}: conversation already exists (use --replace to re-import)`);
      continue;
    }
    if (existing) {
      db.prepare("DELETE FROM invoices WHERE order_id IN (SELECT id FROM orders WHERE conversation_id = ?)").run(existing.id);
      db.prepare("DELETE FROM orders WHERE conversation_id = ?").run(existing.id);
      db.prepare("DELETE FROM conversations WHERE id = ?").run(existing.id); // members and messages cascade
    }
    const first = at(c.messages[0].timestamp);
    const last = at(c.messages.at(-1).timestamp);
    contact ??= run(
      `INSERT INTO users (username, email, name, password_hash, bio, avatar, is_seed, created_at)
       VALUES (?, ?, ?, '!', ?, ?, 1, ?)`,
      c.contact_username, `${c.contact_username}@example.invalid`, c.contact_display_name ?? c.contact_name,
      `${c.service}\n(Test data)`, `https://picsum.photos/seed/${c.contact_username}/300/300`, first,
    );
    const conv = run("INSERT INTO conversations (created_at, updated_at, is_seed) VALUES (?, ?, 1)", first, last);
    db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)").run(conv, owner.id, conv, contact);

    // Orders + invoices: the payer is the buyer, the card comes from its sender.
    const idOf = (sender) => (sender === OWNER_SENDER ? owner.id : contact);
    for (const m of c.messages.filter((x) => x.invoice)) {
      const inv = m.invoice;
      const total = inv.items.reduce((s, i) => s + fils(i.unit_price) * i.quantity, 0);
      const payment = c.messages.find((x) => x.payment_for === inv.key);
      const buyer = idOf(payment.sender);
      const seller = buyer === owner.id ? contact : owner.id;
      const issuer = idOf(m.sender);
      const paidAt = at(payment.timestamp);
      const issuedAt = at(m.timestamp);
      const orderId = run(
        `INSERT INTO orders (seller_id, buyer_id, conversation_id, title, status, total_fils, created_at, updated_at, is_seed)
         VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, 1)`,
        seller, buyer, conv, inv.title, total, at(inv.requested_at ?? c.messages[0].timestamp), Math.max(paidAt, issuedAt),
      );
      const invoiceId = run(
        `INSERT INTO invoices (number, kind, order_id, issuer_id, recipient_id, issued_at, total_fils, currency, payment_method, payment_reference, paid_at, is_seed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'JOD', 'CliQ', ?, ?, 1)`,
        `TMP-${inv.key}-${conv}`, inv.kind, orderId, issuer, issuer === owner.id ? contact : owner.id, issuedAt, total, nextRef(), paidAt,
      );
      inv.items.forEach((it, i) => {
        run("INSERT INTO order_items (order_id, description, quantity, unit_fils, position) VALUES (?, ?, ?, ?, ?)", orderId, it.description, it.quantity, fils(it.unit_price), i);
        run("INSERT INTO invoice_items (invoice_id, description, quantity, unit_fils, position) VALUES (?, ?, ?, ?, ?)", invoiceId, it.description, it.quantity, fils(it.unit_price), i);
      });
    }

    // Messages. Invoices are kept as records (orders, reconciliation) but aren't shown as cards in the chat.
    let lastId = 0;
    for (const m of c.messages) {
      if (m.invoice) continue;
      lastId = run(
        "INSERT INTO messages (conversation_id, sender_id, kind, text, created_at, is_seed) VALUES (?, ?, 'text', ?, ?, 1)",
        conv, idOf(m.sender), m.text, at(m.timestamp),
      );
    }
    db.prepare("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ?").run(lastId, conv);
    imported++;
  }

  // Invoice and receipt numbers run in date order across all conversations.
  const rows = db.prepare("SELECT id, kind, issued_at FROM invoices ORDER BY issued_at, id").all();
  db.prepare("UPDATE invoices SET number = 'TMP-' || id").run();
  const counters = {};
  for (const r of rows) {
    const p = `${r.kind === "receipt" ? "RCPT" : "INV"}-${new Date(r.issued_at + 3 * 3600_000).getUTCFullYear()}`;
    counters[p] = (counters[p] ?? 0) + 1;
    db.prepare("UPDATE invoices SET number = ? WHERE id = ?").run(`${p}-${String(counters[p]).padStart(4, "0")}`, r.id);
  }
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}
ensureWelcomeMessages(db);
console.log(`${replace ? "Imported/replaced" : "Imported"} ${imported} of ${conversations.length} conversations for "${ownerUsername}". Remove them with: npm run seed:business:clean`);
