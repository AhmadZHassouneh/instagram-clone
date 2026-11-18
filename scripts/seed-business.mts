// Seeds fictional business conversations, orders, invoices and receipts (all is_seed = 1).
//
// npm run seed:business -- [--owner demo] [--owner-name "أحمد"] [--businesses 8] [--conversations 2]
//                          [--from 2026-05-01] [--to 2026-09-30] [--seed 42] [--statement out.pdf]
//
// --statement writes a synthetic statement whose transfers correspond to the seeded payments
// (plus unrelated noise), and out.expected-matches.json describing which row pays which invoice.
import fs from "node:fs";
import { openDatabase, databasePath } from "../db/migrate.mjs";
import { ensureWelcomeMessages } from "../db/welcome.mjs";
import { refuseInProduction } from "./lib/env-guard.mjs";
import { planBusinessSeed } from "../src/lib/seed/business/plan";
import { writeSeedPlan } from "../src/lib/seed/business/write";
import { statementFromPlan } from "../src/lib/seed/business/statement";
import { rowsFrom } from "../tests/statements/builder";
import { renderStatementPdf } from "../tests/statements/render-pdf";

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

try {
  refuseInProduction("seed:business");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const today = new Date();
const defaultFrom = new Date(today.getTime() - 150 * 86_400_000).toISOString().slice(0, 10);
const owner = arg("owner", "demo");
const options = {
  businesses: Number(arg("businesses", "8")),
  conversationsPerBusiness: Number(arg("conversations", "2")),
  from: Date.parse(`${arg("from", defaultFrom)}T09:00:00+03:00`),
  to: Date.parse(`${arg("to", today.toISOString().slice(0, 10))}T21:00:00+03:00`),
  seed: Number(arg("seed", String(Date.now() % 100000))),
  ownerName: "",
};
for (const [k, v] of Object.entries(options)) {
  if (k !== "ownerName" && !Number.isFinite(v)) {
    console.error(`Invalid --${k}`);
    process.exit(1);
  }
}

const db = openDatabase();
const ownerRow = db.prepare("SELECT name, username FROM users WHERE username = ?").get(owner) as { name: string; username: string } | undefined;
if (!ownerRow) {
  console.error(`Owner account "${owner}" not found. Pass --owner <username>.`);
  process.exit(1);
}
options.ownerName = arg("owner-name", ownerRow.name.split(" ")[0] || ownerRow.username);

const plan = planBusinessSeed(options);
const result = writeSeedPlan(db, plan, owner);
ensureWelcomeMessages(db); // seeded threads open with the welcome message too

console.log(`Database: ${databasePath()}`);
console.log(`Seed ${options.seed}: ${result.users} businesses, ${result.conversations} conversations, ${result.messages} messages, ${result.orders} orders, ${result.invoices} invoices/receipts.`);
console.log(`Log in as "${owner}" and open Messages to see them. Remove them with: npm run seed:business:clean`);

const statementOut = arg("statement", "");
if (statementOut) {
  const st = statementFromPlan(plan, options.seed);
  const pdf = await renderStatementPdf({
    issueDate: new Date(options.to).toISOString().slice(0, 10).replace(/-/g, "/"),
    holder: st.holder,
    account: st.account,
    periodFrom: st.entries[0]?.date,
    periodTo: st.entries.at(-1)?.date,
    rows: rowsFrom(st.openingFils, st.entries),
  });
  fs.writeFileSync(statementOut, pdf);
  const expected = st.expected.map((e) => ({
    ...e,
    invoiceNumbers: e.invoiceKeys.map((k) => result.invoices_by_key.get(k)!.number),
    invoiceKeys: undefined,
  }));
  const jsonOut = statementOut.replace(/\.pdf$/i, "") + ".expected-matches.json";
  fs.writeFileSync(jsonOut, JSON.stringify({ seed: options.seed, rows: expected }, null, 2) + "\n");
  console.log(`Synthetic statement: ${statementOut} (${st.entries.length} rows)  +  ${jsonOut}`);
}
