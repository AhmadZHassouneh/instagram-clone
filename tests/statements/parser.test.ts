import { describe, expect, it } from "vitest";
import { parseBlinkItems } from "../../src/lib/statements/blink";
import { formatFils, parseFils } from "../../src/lib/statements/money";
import { maskAccount, maskName, maskReference } from "../../src/lib/statements/mask";
import { buildItems, rowsFrom, type StatementSpec } from "./builder";

// All names, accounts and references below are invented.

const parse = (spec: StatementSpec) => {
  const { items, pageCount } = buildItems(spec);
  return parseBlinkItems(items, pageCount);
};

describe("money", () => {
  it("parses JOD text to integer fils without floats", () => {
    expect(parseFils("0.000")).toBe(0);
    expect(parseFils("150.000")).toBe(150000);
    expect(parseFils("1,234.567")).toBe(1234567);
    expect(parseFils("0.1")).toBe(100);
    expect(parseFils("12")).toBe(12000);
    expect(parseFils("-5.005")).toBe(-5005);
    // 0.1 + 0.2 style errors can't happen: sum of many 0.001s is exact
    expect(Array.from({ length: 1000 }, () => parseFils("0.001")).reduce((a, b) => a + b)).toBe(1000);
  });
  it("formats fils back to JOD", () => {
    expect(formatFils(1234567)).toBe("1,234.567");
    expect(formatFils(5)).toBe("0.005");
    expect(formatFils(-2500)).toBe("-2.500");
  });
  it("rejects non-amounts", () => {
    expect(() => parseFils("abc")).toThrow();
    expect(() => parseFils("1.2345")).toThrow();
  });
});

describe("masking", () => {
  it("masks account numbers, names and references", () => {
    expect(maskAccount("5550001234")).toBe("******1234");
    expect(maskName("RAMI SAMIR KHALED")).toBe("R*** S**** K*****");
    expect(maskName("سامر")).toBe("س***");
    expect(maskReference("CLQ998877665")).toBe("********7665");
  });
});

const basic: StatementSpec = {
  holder: "TEST PERSON ONE",
  account: "5550001234",
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  rows: rowsFrom(10000, [
    { date: "2026-08-02", details: "Money Received from RAMI SAMIR KHALED", inFils: 150000 },
    { date: "2026-08-03", details: "Money Sent to HUDA FARES NASSAR", outFils: 45500 },
    { date: "2026-08-05", details: "Cliq Inward CLQ20260805XYZ123", inFils: 75250 },
    { date: "2026-08-31", details: "Interest earned for August", inFils: 1234 },
    { date: "2026-08-31", details: "Tax Deduction on Profit Payment", outFils: 123 },
  ]),
};

describe("parseBlinkItems", () => {
  it("reads the header", () => {
    const r = parse(basic);
    expect(r.header).toEqual({
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      issueDate: "2026-10-01",
      accountHolder: "TEST PERSON ONE",
      accountNumber: "5550001234",
      currency: "Jordanian dinar",
    });
  });

  it("classifies every row type with amounts in fils", () => {
    const r = parse(basic);
    expect(r.openingBalanceFils).toBe(10000);
    expect(r.closingBalanceFils).toBe(10000 + 150000 - 45500 + 75250 + 1234 - 123);
    expect(r.transactions.map((t) => [t.type, t.direction, t.amountFils])).toEqual([
      ["transfer", "in", 150000],
      ["transfer", "out", 45500],
      ["cliq_inward", "in", 75250],
      ["interest", "in", 1234],
      ["tax", "out", 123],
    ]);
    expect(r.transactions[0].counterparty).toBe("RAMI SAMIR KHALED");
    expect(r.transactions[1].counterparty).toBe("HUDA FARES NASSAR");
    expect(r.transactions[2].cliqReference).toBe("CLQ20260805XYZ123");
    expect(r.transactions[0].date).toBe("2026-08-02");
    expect(r.validation.ok).toBe(true);
    expect(r.validation.warnings).toEqual([]);
  });

  it("joins a row split across pages: date start on page 1, rest on page 2", () => {
    const r = parse({
      rows: rowsFrom(0, [
        { date: "2026-08-10", details: "Money Received from ZAID MOHAMMAD ABU SALEH", inFils: 20000 },
        { date: "2026-08-10", details: "Money Received from LAYAN OMAR HADDAD AL ZOUBI", inFils: 30000, breakBeforeLine: 1 },
        { date: "2026-08-11", details: "Money Sent to KAREEM", outFils: 5000 },
      ]),
    });
    expect(r.pageCount).toBe(2);
    const t = r.transactions[1];
    expect(t.date).toBe("2026-08-10");
    expect(t.counterparty).toBe("LAYAN OMAR HADDAD AL ZOUBI");
    expect(t.page).toBe(1);
    expect(t.balanceFils).toBe(50000);
    expect(r.validation.ok).toBe(true);
  });

  it("joins a row whose name continues on the next page after the date is complete", () => {
    const r = parse({
      rows: rowsFrom(0, [
        { date: "2026-08-12", details: "Money Received from ABDULRAHMAN MOHAMMAD KHALIL ABU GHAZALEH", inFils: 99999, breakBeforeLine: 2 },
        { date: "2026-08-13", details: "Money Sent to NOOR", outFils: 1 },
      ]),
    });
    expect(r.pageCount).toBe(2);
    expect(r.transactions[0].counterparty).toBe("ABDULRAHMAN MOHAMMAD KHALIL ABU GHAZALEH");
    expect(r.transactions[0].date).toBe("2026-08-12");
    expect(r.validation.ok).toBe(true);
  });

  it("handles a page break after every possible line of a long row", () => {
    for (let line = 1; line <= 3; line++) {
      const r = parse({
        rows: rowsFrom(5000, [
          { date: "2026-08-01", details: "Money Sent to SOMEONE", outFils: 1000 },
          { date: "2026-08-20", details: "Money Received from MUHANNAD SULEIMAN ABDELKAREEM AL MOMANI", inFils: 2500, breakBeforeLine: line },
          { date: "2026-08-21", details: "Interest earned for August", inFils: 7 },
        ]),
      });
      expect(r.transactions.map((t) => t.date), `break before line ${line}`).toEqual(["2026-08-01", "2026-08-20", "2026-08-21"]);
      expect(r.transactions[1].counterparty, `break before line ${line}`).toBe("MUHANNAD SULEIMAN ABDELKAREEM AL MOMANI");
      expect(r.validation.ok, `break before line ${line}`).toBe(true);
    }
  });

  it("reports a broken running balance at the right row, once", () => {
    const r = parse({
      rows: rowsFrom(0, [
        { date: "2026-08-01", details: "Money Received from A B", inFils: 10000 },
        { date: "2026-08-02", details: "Money Received from C D", inFils: 10000, balanceOverrideFils: 25000 },
        { date: "2026-08-03", details: "Money Sent to E F", outFils: 5000, balanceOverrideFils: 20000 },
      ]),
    });
    expect(r.validation.ok).toBe(false);
    expect(r.validation.rowMismatches).toEqual([
      { index: 2, page: 1, date: "2026-08-02", expectedBalanceFils: 20000, printedBalanceFils: 25000, differenceFils: 5000 },
    ]);
  });

  it("flags a closing balance that doesn't equal opening + added − deducted", () => {
    const rows = rowsFrom(0, [{ date: "2026-08-01", details: "Money Received from A B", inFils: 10000 }]);
    rows.at(-1)!.balance = "11.000";
    const r = parse({ rows });
    expect(r.validation.closing.ok).toBe(false);
    expect(r.validation.closing.expectedClosingFils).toBe(10000);
    expect(r.validation.closing.printedClosingFils).toBe(11000);
  });

  it("ignores page footers and full-width disclaimers", () => {
    const r = parse({
      footer: true,
      linesPerPage: 12,
      rows: rowsFrom(
        0,
        Array.from({ length: 20 }, (_, i) => ({
          date: `2026-08-${String(i + 1).padStart(2, "0")}`,
          details: `Money Received from PERSON NUMBER ${i + 1}`,
          inFils: 1000 * (i + 1),
        })),
      ),
    });
    expect(r.pageCount).toBeGreaterThan(3);
    expect(r.transactions).toHaveLength(20);
    expect(r.transactions.every((t) => /^PERSON NUMBER \d+$/.test(t.counterparty!))).toBe(true);
    expect(r.validation.ok).toBe(true);
  });

  it("reports unknown row types instead of dropping them", () => {
    const r = parse({
      rows: rowsFrom(1000, [
        { date: "2026-08-01", details: "Card Purchase SOME SHOP", outFils: 500 },
        { date: "2026-08-02", details: "Money Received from X Y", inFils: 100 },
      ]),
    });
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions[0].type).toBe("other");
    expect(r.validation.warnings.some((w) => w.includes("unrecognised"))).toBe(true);
    expect(r.validation.rowMismatches).toEqual([]);
  });
});
