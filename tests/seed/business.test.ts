import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../db/migrate.mjs";
import { isProduction, refuseInProduction } from "../../scripts/lib/env-guard.mjs";
import { planBusinessSeed, type SeedOptions } from "../../src/lib/seed/business/plan";
import { statementFromPlan } from "../../src/lib/seed/business/statement";
import { deleteSeedData, writeSeedPlan } from "../../src/lib/seed/business/write";
import { parseBlinkStatement } from "../../src/lib/statements/blink";
import { formatFils } from "../../src/lib/statements/money";
import { rowsFrom } from "../statements/builder";
import { renderStatementPdf } from "../statements/render-pdf";

const base: SeedOptions = {
  businesses: 8,
  conversationsPerBusiness: 3,
  from: Date.parse("2026-04-01T09:00:00+03:00"),
  to: Date.parse("2026-09-30T21:00:00+03:00"),
  seed: 42,
  ownerName: "سامي",
};

describe("planBusinessSeed", () => {
  it("is reproducible from the seed", () => {
    expect(JSON.stringify(planBusinessSeed(base))).toBe(JSON.stringify(planBusinessSeed(base)));
    expect(JSON.stringify(planBusinessSeed({ ...base, seed: 43 }))).not.toBe(JSON.stringify(planBusinessSeed(base)));
  });

  it("respects the options", () => {
    const plan = planBusinessSeed(base);
    expect(plan.threads).toHaveLength(8);
    expect(plan.threads.some((t) => t.business.role === "vendor")).toBe(true);
    expect(plan.threads.some((t) => t.business.role === "client")).toBe(true);
    for (const t of plan.threads) expect(t.orders).toHaveLength(3);
    expect(() => planBusinessSeed({ ...base, businesses: 99 })).toThrow();
  });

  for (const seed of [1, 2, 3, 42, 777]) {
    it(`keeps amounts consistent across each conversation (seed ${seed})`, () => {
      const plan = planBusinessSeed({ ...base, seed });
      for (const t of plan.threads) {
        for (const o of t.orders) {
          expect(o.items.reduce((s, i) => s + i.unitFils * i.quantity, 0)).toBe(o.totalFils);
          const inv = t.invoices.find((i) => i.key === o.invoiceKey)!;
          expect(inv.totalFils).toBe(o.totalFils);
          expect(inv.paidAt).not.toBeNull();
          expect(o.status).toBe("paid");
          expect(o.totalFils).toBeGreaterThan(0);
        }
        // Every invoice is paid in full: deposits + final transfers (possibly combined) add up.
        const paidTo = (dir: "in" | "out") => t.payments.filter((p) => p.direction === dir).reduce((s, p) => s + p.amountFils, 0);
        const invoiced = (issuer: "owner" | "biz") => t.invoices.filter((i) => i.issuer === issuer).reduce((s, i) => s + i.totalFils, 0);
        expect(paidTo("in")).toBe(invoiced("owner"));
        expect(paidTo("out")).toBe(invoiced("biz"));
        // The exact amount transferred was stated in the chat by the time of the payment
        // (in the "I've paid" message itself, or the price/pay-info message just before it).
        for (const p of t.payments) {
          const said = t.messages.some((m) => m.at <= p.at && m.at > p.at - 3 * 86_400_000 && m.text.includes(formatFils(p.amountFils)));
          expect(said, `${t.business.username} payment ${formatFils(p.amountFils)}`).toBe(true);
        }
      }
    });
  }

  it("produces realistic, ordered messages", () => {
    const plan = planBusinessSeed(base);
    const all = plan.threads.flatMap((t) => t.messages);
    for (const t of plan.threads) {
      for (let i = 1; i < t.messages.length; i++) expect(t.messages[i].at).toBeGreaterThanOrEqual(t.messages[i - 1].at);
      expect(t.messages[0].at).toBeGreaterThanOrEqual(base.from);
    }
    for (const m of all) {
      if (m.kind === "text") expect(m.text.length).toBeGreaterThan(0);
      if (m.kind === "voice") expect(m.voiceSeconds).toBeGreaterThan(0);
      if (m.kind === "invoice" || m.kind === "receipt") expect(m.invoiceKey).toBeTruthy();
      // Between 9:00 and 23:30 Amman time
      const local = new Date(m.at + 3 * 3600_000);
      expect(local.getUTCHours() >= 9 && local.getUTCHours() + local.getUTCMinutes() / 60 < 23.5 + 0.5).toBe(true);
    }
    expect(all.some((m) => /[؀-ۿ]/.test(m.text))).toBe(true); // Arabic
    expect(all.some((m) => /\b(design|backend|admin panel|staging|deal)\b/.test(m.text))).toBe(true); // English tech terms
    expect(all.some((m) => m.kind === "voice")).toBe(true);
    // Repeat clients: some client threads have several paid orders.
    expect(plan.threads.some((t) => t.business.role === "client" && t.orders.length > 1)).toBe(true);
  });
});

describe("env guard", () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV };
  afterEach(() => {
    Object.assign(process.env, saved);
    if (saved.APP_ENV === undefined) delete process.env.APP_ENV;
  });

  it("refuses production via NODE_ENV or APP_ENV", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(isProduction()).toBe(true);
    expect(() => refuseInProduction("test")).toThrow(/production/);
    (process.env as Record<string, string>).NODE_ENV = "test";
    process.env.APP_ENV = "prod";
    expect(() => refuseInProduction("test")).toThrow();
    process.env.APP_ENV = "development";
    expect(() => refuseInProduction("test")).not.toThrow();
  });
});

describe("writeSeedPlan / deleteSeedData", () => {
  it("writes only is_seed rows and cleans them up without touching real data", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sg-")), "test.db");
    const db = openDatabase(file);
    const t0 = Date.now();
    const owner = Number(db.prepare("INSERT INTO users (username, email, name, password_hash, created_at) VALUES ('owner', 'o@x.test', 'Owner', 'x', ?)").run(t0).lastInsertRowid);
    const friend = Number(db.prepare("INSERT INTO users (username, email, name, password_hash, created_at) VALUES ('friend', 'f@x.test', 'Friend', 'x', ?)").run(t0).lastInsertRowid);
    const conv = Number(db.prepare("INSERT INTO conversations (created_at, updated_at) VALUES (?, ?)").run(t0, t0).lastInsertRowid);
    db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)").run(conv, owner, conv, friend);
    db.prepare("INSERT INTO messages (conversation_id, sender_id, text, created_at) VALUES (?, ?, 'real message', ?)").run(conv, friend, t0);

    const plan = planBusinessSeed({ ...base, businesses: 5, conversationsPerBusiness: 2 });
    const r = writeSeedPlan(db, plan, "owner");
    expect(r.users).toBe(5);
    expect(r.conversations).toBe(5);
    expect(r.invoices).toBe(10);

    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    for (const table of ["users", "conversations", "messages", "orders", "invoices"]) {
      expect(count(`SELECT COUNT(*) AS n FROM ${table} WHERE is_seed = 0`), table).toBe(table === "users" ? 2 : table === "conversations" || table === "messages" ? 1 : 0);
    }
    // Invoice numbers are unique and well-formed; every card message points at an invoice.
    const numbers = (db.prepare("SELECT number FROM invoices").all() as { number: string }[]).map((x) => x.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((n) => /^(INV|RCPT)-\d{4}-\d{4}$/.test(n))).toBe(true);
    expect(count("SELECT COUNT(*) AS n FROM messages WHERE kind IN ('invoice','receipt') AND invoice_id IS NULL")).toBe(0);
    // Invoice totals equal the sum of their line items.
    expect(count(`SELECT COUNT(*) AS n FROM invoices v WHERE total_fils != (SELECT SUM(unit_fils * quantity) FROM invoice_items WHERE invoice_id = v.id)`)).toBe(0);

    // Seeding twice reuses the business accounts and continues invoice numbering.
    writeSeedPlan(db, planBusinessSeed({ ...base, businesses: 5, conversationsPerBusiness: 2, seed: 99 }), "owner");
    expect(count("SELECT COUNT(DISTINCT number) AS n FROM invoices")).toBe(count("SELECT COUNT(*) AS n FROM invoices"));

    deleteSeedData(db);
    for (const table of ["orders", "invoices", "invoice_items", "order_items"]) expect(count(`SELECT COUNT(*) AS n FROM ${table}`), table).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM users")).toBe(2);
    expect(count("SELECT COUNT(*) AS n FROM conversations")).toBe(1);
    expect(count("SELECT COUNT(*) AS n FROM messages")).toBe(1);
    db.close();
  });

  it("refuses to reuse a real account's username", () => {
    const db = openDatabase(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sg-")), "test.db"));
    db.prepare("INSERT INTO users (username, email, name, password_hash, created_at) VALUES ('owner', 'o@x.test', 'Owner', 'x', 1)").run();
    const plan = planBusinessSeed({ ...base, businesses: 3 });
    db.prepare("INSERT INTO users (username, email, name, password_hash, created_at) VALUES (?, 'r@x.test', 'Real', 'x', 1)").run(plan.threads[0].business.username);
    expect(() => writeSeedPlan(db, plan, "owner")).toThrow(/real account/);
    expect((db.prepare("SELECT COUNT(*) AS n FROM invoices").get() as { n: number }).n).toBe(0); // rolled back
    db.close();
  });
});

describe("statementFromPlan", () => {
  it("renders a valid synthetic statement containing every seeded payment", async () => {
    const plan = planBusinessSeed(base);
    const st = statementFromPlan(plan, base.seed);
    const pdf = await renderStatementPdf({
      holder: st.holder,
      account: st.account,
      periodFrom: st.entries[0].date,
      periodTo: st.entries.at(-1)!.date,
      rows: rowsFrom(st.openingFils, st.entries),
    });
    const parsed = await parseBlinkStatement(pdf);
    expect(parsed.validation.ok).toBe(true);
    expect(parsed.validation.warnings).toEqual([]);
    expect(parsed.transactions).toHaveLength(st.entries.length);
    const payments = plan.threads.flatMap((t) => t.payments);
    expect(st.expected.filter((e) => e.kind === "payment")).toHaveLength(payments.length);
    // Rows line up with what the parser reads.
    for (const e of st.expected) {
      const t = parsed.transactions[e.index - 1];
      expect(t.amountFils).toBe(e.amountFils);
      expect(t.direction).toBe(e.direction);
      expect(t.date).toBe(e.date);
    }
  });
});
