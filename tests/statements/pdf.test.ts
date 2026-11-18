import { describe, expect, it } from "vitest";
import { parseBlinkStatement } from "../../src/lib/statements/blink";
import { rowsFrom } from "./builder";
import { renderStatementPdf } from "./render-pdf";

// Goes through the real pdf.js extraction path with a generated (fictional) PDF.
describe("parseBlinkStatement (real PDF)", () => {
  it("extracts and validates a multi-page statement with a mid-row page break", async () => {
    const pdf = await renderStatementPdf({
      holder: "FICTIONAL ACCOUNT HOLDER",
      account: "7770004321",
      periodFrom: "2026-07-01",
      periodTo: "2026-07-31",
      footer: true,
      linesPerPage: 30,
      rows: rowsFrom(2500, [
        ...Array.from({ length: 12 }, (_, i) => ({
          date: `2026-07-${String(i + 1).padStart(2, "0")}`,
          details: i % 3 === 0 ? `Money Sent to VENDOR NUMBER ${i}` : `Money Received from CLIENT NUMBER ${i}`,
          inFils: i % 3 === 0 ? undefined : 12345 * (i + 1),
          outFils: i % 3 === 0 ? 1500 : undefined,
        })),
        { date: "2026-07-20", details: "Cliq Inward REF2026072000ABCD", inFils: 33333 },
        { date: "2026-07-31", details: "Interest earned for July", inFils: 812 },
        { date: "2026-07-31", details: "Tax Deduction on Profit Payment", outFils: 81 },
      ]),
    });

    const r = await parseBlinkStatement(pdf);
    expect(r.pageCount).toBeGreaterThan(1);
    expect(r.header.accountHolder).toBe("FICTIONAL ACCOUNT HOLDER");
    expect(r.header.accountNumber).toBe("7770004321");
    expect(r.transactions).toHaveLength(15);
    expect(r.transactions.map((t) => t.type).slice(-3)).toEqual(["cliq_inward", "interest", "tax"]);
    expect(r.transactions[12].cliqReference).toBe("REF2026072000ABCD");
    expect(r.validation.rowMismatches).toEqual([]);
    expect(r.validation.ok).toBe(true);
  });
});
