import { isAmount, parseFils } from "../money";
import type { PageLayout, TableLine } from "./layout";
import type { StatementHeader, Transaction, TxnType } from "./types";

/** A logical table row assembled from one or more visual lines (possibly across pages). */
export type RawRow = {
  page: number;
  date: string;
  details: string[];
  added: string | null;
  deducted: string | null;
  balance: string | null;
};

// Phrases that start a new row in the Details column.
const ROW_START = [
  /^opening balance\b/i,
  /^closing balance\b/i,
  /^money received from\b/i,
  /^money sent to\b/i,
  /^interest earned\b/i,
  /^tax deduction\b/i,
  /^cliq inward\b/i,
];
const startsRow = (details: string) => ROW_START.some((re) => re.test(details));

const DATE_FULL = /^\d{4}-\d{2}-\d{2}$/;
const dateComplete = (d: string) => DATE_FULL.test(d.replace(/\s/g, ""));
/** Looks like the first part of a date ("2026-08-", "2026-08-10", "2026-"). */
const dateStart = (d: string) => /^\d{4}-/.test(d.replace(/\s/g, ""));

/**
 * Joins visual lines into rows. Rows start at a known Details phrase. Everything else attaches
 * to the row it continues: wrapped names, the second half of a split date ("2026-08-" + "10"),
 * and amounts that are vertically centred in the cell. Fragments that clearly belong to the
 * *next* row (e.g. a date or balance that appears before that row's Details after a page break)
 * are held as "pending" until the next row starts.
 */
export function assembleRows(pages: PageLayout[]): RawRow[] {
  const rows: RawRow[] = [];
  let current: RawRow | null = null;
  // Fragments seen after the current row was finished but before the next row's Details phrase.
  let pending: { page?: number; date?: string; added?: string; deducted?: string; balance?: string } = {};

  const startRow = (line: TableLine, firstDetails: string) => {
    const row: RawRow = {
      page: pending.page ?? line.page,
      date: pending.date ?? "",
      details: [firstDetails],
      added: pending.added ?? null,
      deducted: pending.deducted ?? null,
      balance: pending.balance ?? null,
    };
    pending = {};
    rows.push(row);
    return row;
  };
  const finished = (r: RawRow | null) => !!r && dateComplete(r.date) && r.balance !== null;

  for (const page of pages) {
    for (const line of page.lines) {
      const { date, details, added, deducted, balance } = line.cells;
      const cleanDate = date.replace(/\s/g, "");

      // 1. Details: a known phrase starts a row; a new date after a finished row also starts one
      //    (unknown row types); anything else continues the current row (wrapped names/refs).
      if (details && startsRow(details)) current = startRow(line, details);
      else if (details && cleanDate && dateStart(cleanDate) && finished(current)) current = startRow(line, details);
      else if (details && current) current.details.push(details);
      // Text before the first row (shouldn't happen) is ignored.

      // 2. Date: continue an unfinished date ("2026-08-" + "10"); a fresh date that can't
      //    belong to the current row waits for the next one.
      if (cleanDate) {
        const canContinue = current && !dateComplete(current.date) && (!current.date || !dateStart(cleanDate));
        if (current && canContinue) current.date += cleanDate;
        else {
          pending.date = (pending.date ?? "") + cleanDate;
          pending.page ??= line.page;
        }
      }

      // 3. Amounts sit on the same line as the balance. Once a row has its balance, any further
      //    amounts belong to the next row.
      for (const [key, value] of [["added", added], ["deducted", deducted], ["balance", balance]] as const) {
        if (!value || !isAmount(value)) continue;
        if (current && current.balance === null && current[key] === null) current[key] = value;
        else {
          pending[key] = value;
          pending.page ??= line.page;
        }
      }
    }
  }
  return rows;
}

const PATTERNS: { re: RegExp; type: TxnType; direction: "in" | "out" }[] = [
  { re: /^money received from\s+(.*)$/i, type: "transfer", direction: "in" },
  { re: /^money sent to\s+(.*)$/i, type: "transfer", direction: "out" },
  { re: /^cliq inward\s*(.*)$/i, type: "cliq_inward", direction: "in" },
  { re: /^interest earned\b.*$/i, type: "interest", direction: "in" },
  { re: /^tax deduction\b.*$/i, type: "tax", direction: "out" },
];

export type ClassifiedRows = {
  opening: RawRow | null;
  closing: RawRow | null;
  transactions: Transaction[];
  warnings: string[];
};

export function classifyRows(rows: RawRow[]): ClassifiedRows {
  let opening: RawRow | null = null;
  let closing: RawRow | null = null;
  const transactions: Transaction[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    const text = row.details.join(" ").replace(/\s+/g, " ").trim();
    if (/^opening balance/i.test(text)) {
      opening = row;
      continue;
    }
    if (/^closing balance/i.test(text)) {
      closing = row;
      continue;
    }
    const index = transactions.length + 1;
    if (!dateComplete(row.date)) warnings.push(`Row ${index} (page ${row.page}): incomplete date "${row.date}".`);
    if (row.balance === null) warnings.push(`Row ${index} (page ${row.page}): no balance found.`);
    if ((row.added === null) === (row.deducted === null))
      warnings.push(`Row ${index} (page ${row.page}): expected exactly one of Amount Added / Amount Deducted.`);

    const pattern = PATTERNS.find((p) => p.re.test(text));
    const direction: "in" | "out" = row.added !== null ? "in" : row.deducted !== null ? "out" : (pattern?.direction ?? "in");
    if (!pattern) warnings.push(`Row ${index} (page ${row.page}): unrecognised row type.`);
    else if (pattern.direction !== direction)
      warnings.push(`Row ${index} (page ${row.page}): ${pattern.type} row is in the ${direction === "in" ? "Added" : "Deducted"} column.`);

    const captured = pattern ? (pattern.re.exec(text)?.[1] ?? "").trim() : "";
    transactions.push({
      index,
      page: row.page,
      date: row.date,
      direction,
      type: pattern?.type ?? "other",
      counterparty: pattern?.type === "transfer" && captured ? captured : null,
      cliqReference: pattern?.type === "cliq_inward" && captured ? captured.replace(/\s+/g, "") : null,
      description: text,
      amountFils: parseFils(row.added ?? row.deducted ?? "0"),
      balanceFils: row.balance !== null ? parseFils(row.balance) : 0,
    });
  }
  return { opening, closing, transactions, warnings };
}

const normDate = (d: string) => d.replace(/\//g, "-");
const DATE = String.raw`(\d{4}[-/]\d{2}[-/]\d{2})`;

/** Reads account details from the text above the table on the first pages. */
export function parseHeader(preamble: string[]): StatementHeader {
  const text = preamble.join("\n");
  const one = (re: RegExp) => re.exec(text)?.[1]?.trim() ?? null;

  let periodFrom = one(new RegExp(String.raw`(?:from|period)\s*:?\s*${DATE}`, "i"));
  let periodTo = one(new RegExp(String.raw`(?:\bto|until)\s*:?\s*${DATE}`, "i"));
  const range = new RegExp(String.raw`${DATE}\s*(?:-|–|to)\s*${DATE}`, "i").exec(text);
  if (range) {
    periodFrom ??= range[1];
    periodTo ??= range[2];
  }
  let issueDate = one(new RegExp(String.raw`issue(?:d)?\s*(?:date|on)?\s*:?\s*${DATE}`, "i"));
  // Blink prints the issue date on a line of its own above the name.
  issueDate ??= preamble.map((l) => l.trim()).find((l) => new RegExp(`^${DATE}$`).test(l)) ?? null;

  return {
    periodFrom: periodFrom && normDate(periodFrom),
    periodTo: periodTo && normDate(periodTo),
    issueDate: issueDate && normDate(issueDate),
    accountHolder: one(/(?:^|\n)\s*(?:account holder|customer name|name)\s*:\s*([^\n]+)/i),
    accountNumber: one(/account\s*(?:number|no\.?)\s*:?\s*([\d][\d\s-]{4,}\d)/i)?.replace(/[\s-]/g, "") ?? null,
    currency: one(/currency\s*:\s*([^\n]+)/i),
  };
}
