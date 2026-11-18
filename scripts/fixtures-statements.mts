// Renders the synthetic statement fixtures to tests/fixtures/statements/*.pdf (+ .expected.json).
// Usage: npm run fixtures:statements [-- --seed 2026]
import fs from "node:fs";
import path from "node:path";
import { buildFixtures } from "../tests/statements/fixtures";
import { renderStatementPdf } from "../tests/statements/render-pdf";

const args = process.argv.slice(2);
const seed = args.includes("--seed") ? Number(args[args.indexOf("--seed") + 1]) : 2026;
const dir = path.join(process.cwd(), "tests", "fixtures", "statements");
fs.mkdirSync(dir, { recursive: true });

for (const f of buildFixtures(seed)) {
  fs.writeFileSync(path.join(dir, `${f.name}.pdf`), await renderStatementPdf(f.spec));
  fs.writeFileSync(
    path.join(dir, `${f.name}.expected.json`),
    JSON.stringify({ description: f.description, seed, ...f.expected }, null, 2) + "\n",
  );
  console.log(`${f.name}.pdf  ${f.expected.rowCount} rows, ${f.expected.pageCount} page(s) — ${f.description}`);
}
console.log(`\nWrote ${dir}`);
