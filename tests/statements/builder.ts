// Lays out statement rows the way the Blink PDF does (positions in PDF points), producing the
// same TextItems pdf.js would extract. Used by the unit tests and by the fixture PDF generator.
import type { TextItem } from "../../src/lib/statements/blink/types";

export type RowSpec = {
  date: string; // YYYY-MM-DD, printed split as "YYYY-MM-" / "DD"
  details: string[]; // already-wrapped Details lines
  added?: string;
  deducted?: string;
  balance: string;
  /** Force a page break before this line of the row (1 = after the first line). */
  breakBeforeLine?: number;
};

export type StatementSpec = {
  issueDate?: string;
  holder?: string;
  account?: string;
  currency?: string;
  periodFrom?: string;
  periodTo?: string;
  rows: RowSpec[];
  /** Lines per page before an automatic break (default 40). */
  linesPerPage?: number;
  footer?: boolean;
};

export const PAGE = { width: 595, height: 842 };
export const COL = {
  date: { x: 40, w: 70 },
  details: { x: 115, w: 190 },
  added: { x: 310, w: 90 },
  deducted: { x: 405, w: 90 },
  balance: { x: 500, w: 75 },
};
const LINE_H = 13;
const BOTTOM_MARGIN = 80;
const CHAR_W = 5.2; // rough text width per character at the fixture font size

const textW = (s: string) => s.length * CHAR_W;

/** Word-wraps a string to Blink's Details column width. */
export function wrap(text: string, max = 24): string[] {
  const out: string[] = [];
  let line = "";
  // Words longer than a line (CliQ references) are broken into pieces, like the PDF does.
  const words = text.split(/\s+/).flatMap((w) => w.match(new RegExp(`.{1,${max}}`, "g")) ?? []);
  for (const word of words) {
    if (line && (line + " " + word).length > max) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

export type Placed = TextItem & { bold?: boolean };

export function buildItems(spec: StatementSpec): { items: Placed[]; pageCount: number } {
  const items: Placed[] = [];
  const perPage = spec.linesPerPage ?? 40;
  let page = 1;
  let y = 0;
  let used = 0;

  const put = (str: string, x: number, yy: number, bold = false) =>
    items.push({ page, x, y: yy, width: textW(str), str, bold });
  const right = (str: string, col: { x: number; w: number }, yy: number) => put(str, col.x + col.w - textW(str), yy);
  const centre = (str: string, col: { x: number; w: number }, yy: number) => put(str, col.x + (col.w - textW(str)) / 2, yy, true);

  const tableHeader = () => {
    const top = y;
    centre("Date", COL.date, top - 13);
    centre("Details", COL.details, top - 13);
    centre("Amount", COL.added, top);
    centre("Added", COL.added, top - 13);
    centre("(JOD)", COL.added, top - 26);
    centre("Amount", COL.deducted, top);
    centre("Deducted", COL.deducted, top - 13);
    centre("(JOD)", COL.deducted, top - 26);
    centre("Balance", COL.balance, top - 13);
    y = top - 26 - LINE_H * 1.5;
  };

  const newPage = (first: boolean) => {
    if (!first) {
      if (spec.footer) put(`Page ${page}`, PAGE.width / 2 - 15, 30);
      page++;
    }
    y = PAGE.height - 50;
    used = 0;
    if (first) {
      put(spec.issueDate ?? "2026/10/01", 40, y);
      put(`Name: ${spec.holder ?? "TEST HOLDER"}`, 40, y - 15);
      put(`Account Number: ${spec.account ?? "1000000001"}`, 380, y - 40);
      put(`Currency: ${spec.currency ?? "Jordanian dinar"}`, 410, y - 55);
      if (spec.periodFrom) put(`From: ${spec.periodFrom}  To: ${spec.periodTo}`, 40, y - 40);
      y -= 80;
    }
    if (spec.footer) {
      // A long disclaimer line spanning the whole table width (must be ignored).
      put("This statement is generated electronically and does not require a signature or stamp.", 40, 60);
    }
    tableHeader();
  };

  newPage(true);
  for (const row of spec.rows) {
    const [d1, d2] = [row.date.slice(0, 8), row.date.slice(8)];
    const n = Math.max(2, row.details.length);
    const mid = Math.floor((n - 1) / 2);
    for (let i = 0; i < n; i++) {
      // Break on the line budget, a forced break, or running out of paper (keep a bottom margin).
      if (used >= perPage || row.breakBeforeLine === i || y < BOTTOM_MARGIN) newPage(false);
      if (i === 0) put(d1, COL.date.x, y);
      if (i === 1) put(d2, COL.date.x, y);
      if (row.details[i]) put(row.details[i], COL.details.x, y);
      if (i === mid) {
        if (row.added) right(row.added, COL.added, y);
        if (row.deducted) right(row.deducted, COL.deducted, y);
        right(row.balance, COL.balance, y);
      }
      y -= LINE_H;
      used++;
    }
    y -= LINE_H; // gap between rows
    used++;
  }
  if (spec.footer) put(`Page ${page}`, PAGE.width / 2 - 15, 30);
  return { items, pageCount: page };
}

/** Convenience: builds rows with running balances from simple entries (amounts in fils). */
export function rowsFrom(
  openingFils: number,
  entries: { date: string; details: string; inFils?: number; outFils?: number; breakBeforeLine?: number; balanceOverrideFils?: number }[],
  closingDate = entries.at(-1)?.date ?? "2026-08-31",
): RowSpec[] {
  const fmt = (f: number) => `${Math.floor(f / 1000).toLocaleString("en-US")}.${String(f % 1000).padStart(3, "0")}`;
  let bal = openingFils;
  const rows: RowSpec[] = [{ date: entries[0]?.date ?? closingDate, details: ["Opening Balance"], balance: fmt(bal) }];
  for (const e of entries) {
    bal += (e.inFils ?? 0) - (e.outFils ?? 0);
    const shown = e.balanceOverrideFils ?? bal;
    rows.push({
      date: e.date,
      details: wrap(e.details),
      added: e.inFils ? fmt(e.inFils) : undefined,
      deducted: e.outFils ? fmt(e.outFils) : undefined,
      balance: fmt(shown),
      breakBeforeLine: e.breakBeforeLine,
    });
  }
  rows.push({ date: closingDate, details: ["Closing Balance"], balance: fmt(bal) });
  return rows;
}
