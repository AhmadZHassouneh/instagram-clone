import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBlinkStatement } from "../../src/lib/statements/blink";
import { buildFixtures, type Expected } from "./fixtures";

const dir = path.join(process.cwd(), "tests", "fixtures", "statements");
const pdfs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".pdf")).sort() : [];

describe("synthetic statement fixtures", () => {
  it("are generated (run `npm run fixtures:statements`)", () => {
    expect(pdfs.length).toBe(buildFixtures().length);
  });

  it("are reproducible from the seed", () => {
    expect(JSON.stringify(buildFixtures(7))).toBe(JSON.stringify(buildFixtures(7)));
    expect(JSON.stringify(buildFixtures(7))).not.toBe(JSON.stringify(buildFixtures(8)));
  });

  for (const file of pdfs) {
    it(`parses ${file}`, async () => {
      const expected: Expected = JSON.parse(fs.readFileSync(path.join(dir, file.replace(/\.pdf$/, ".expected.json")), "utf8"));
      const r = await parseBlinkStatement(new Uint8Array(fs.readFileSync(path.join(dir, file))));
      const v = r.validation;

      expect(r.pageCount).toBe(expected.pageCount);
      expect(r.transactions).toHaveLength(expected.rowCount);
      expect(r.openingBalanceFils).toBe(expected.openingFils);
      expect(r.closingBalanceFils).toBe(expected.closingFils);
      expect(v.closing.totalAddedFils).toBe(expected.totalAddedFils);
      expect(v.closing.totalDeductedFils).toBe(expected.totalDeductedFils);

      const byType: Record<string, number> = {};
      for (const t of r.transactions) byType[t.type] = (byType[t.type] ?? 0) + 1;
      expect(byType).toEqual(expected.byType);

      expect(r.transactions.filter((t) => t.type === "transfer").map((t) => t.counterparty)).toEqual(expected.counterparties);
      expect(r.transactions.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date))).toBe(true);
      expect(r.transactions.filter((t) => t.type === "cliq_inward").every((t) => /^[A-Z0-9]{10,}$/.test(t.cliqReference ?? ""))).toBe(true);

      expect(v.rowMismatches.map((m) => m.index)).toEqual(expected.mismatchIndexes);
      expect(v.closing.ok).toBe(expected.closingOk);
      expect(v.ok).toBe(expected.ok);
      expect(v.warnings).toEqual([]);
    });
  }
});
