// Parse a Blink statement PDF and print a masked summary + validation report.
// Usage: npm run statement:parse -- <file.pdf> [--json out.json] [--rows]
//   --json  write the full, UNMASKED result to a file (never printed)
//   --rows  print every transaction (masked)
import fs from "node:fs";
import { parseBlinkStatement } from "../src/lib/statements/blink";
import { formatFils } from "../src/lib/statements/money";
import { maskAccount, maskName, maskReference } from "../src/lib/statements/mask";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--json");
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
if (!file) {
  console.error("Usage: npm run statement:parse -- <file.pdf> [--json out.json] [--rows]");
  process.exit(1);
}

const result = await parseBlinkStatement(new Uint8Array(fs.readFileSync(file)));
const h = result.header;
const v = result.validation;

console.log(`Pages:          ${result.pageCount}`);
console.log(`Account holder: ${maskName(h.accountHolder)}`);
console.log(`Account number: ${maskAccount(h.accountNumber)}`);
console.log(`Currency:       ${h.currency ?? "?"}`);
console.log(`Period:         ${h.periodFrom ?? "?"} → ${h.periodTo ?? "?"}   (issued ${h.issueDate ?? "?"})`);
console.log(`Transactions:   ${result.transactions.length}`);
const byType = Object.groupBy(result.transactions, (t) => t.type);
console.log(`  by type:      ${Object.entries(byType).map(([k, v]) => `${k} ${v!.length}`).join(", ")}`);
console.log(`Opening:        ${result.openingBalanceFils === null ? "?" : formatFils(result.openingBalanceFils)}`);
console.log(`Total added:    ${formatFils(v.closing.totalAddedFils)}`);
console.log(`Total deducted: ${formatFils(v.closing.totalDeductedFils)}`);
console.log(`Closing:        ${v.closing.printedClosingFils === null ? "?" : formatFils(v.closing.printedClosingFils)} (expected ${formatFils(v.closing.expectedClosingFils)})`);

if (args.includes("--rows")) {
  console.log("\n#    page date        dir type         amount        balance       counterparty / ref");
  for (const t of result.transactions) {
    const who = t.counterparty ? maskName(t.counterparty) : t.cliqReference ? `ref ${maskReference(t.cliqReference)}` : "";
    console.log(
      `${String(t.index).padEnd(4)} ${String(t.page).padEnd(4)} ${t.date.padEnd(11)} ${t.direction.padEnd(3)} ${t.type.padEnd(12)} ${formatFils(t.amountFils).padStart(12)}  ${formatFils(t.balanceFils).padStart(12)}  ${who}`,
    );
  }
}

console.log(`\nValidation: ${v.ok ? "OK ✓" : "PROBLEMS FOUND ✗"}`);
for (const m of v.rowMismatches) {
  console.log(
    `  Row ${m.index} (page ${m.page}, ${m.date}): balance ${formatFils(m.printedBalanceFils)}, expected ${formatFils(m.expectedBalanceFils)} (off by ${formatFils(m.differenceFils)})`,
  );
}
if (!v.closing.ok) console.log(`  Closing balance does not equal opening + added − deducted.`);
for (const w of v.warnings) console.log(`  warning: ${w}`);

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
  console.log(`\nFull (unmasked) result written to ${jsonOut}`);
}
process.exit(v.ok ? 0 : 2);
