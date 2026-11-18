import type { TextItem } from "./types";

export type Column = "date" | "details" | "added" | "deducted" | "balance";
export const COLUMNS: Column[] = ["date", "details", "added", "deducted", "balance"];

/** One visual line of the table, split into the five columns. */
export type TableLine = { page: number; y: number; cells: Record<Column, string> };

export type PageLayout = {
  /** Text above the table header (statement header: name, account, period...). */
  preamble: string[];
  /** Table lines below the header, top to bottom. */
  lines: TableLine[];
};

const LINE_TOLERANCE = 3; // points: items closer than this vertically are on the same line

/** Groups items into lines (top to bottom), each line's items left to right. */
export function groupLines(items: TextItem[]): TextItem[][] {
  const sorted = [...items].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0].y - item.y) <= LINE_TOLERANCE) line.push(item);
    else lines.push([item]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

const center = (i: TextItem) => i.x + i.width / 2;
const lineText = (l: TextItem[]) => l.map((i) => i.str.trim()).join(" ").replace(/\s+/g, " ").trim();

type Header = { centers: Record<Column, number>; top: number; bottom: number };

/**
 * Finds the table header (Date | Details | Amount Added (JOD) | Amount Deducted (JOD) | Balance).
 * Header cells wrap onto several lines, so we look for each word near the "Date" line.
 */
function findHeader(lines: TextItem[][]): Header | null {
  for (const line of lines) {
    const date = line.find((i) => /^date$/i.test(i.str.trim()));
    const details = line.find((i) => /^details$/i.test(i.str.trim()));
    if (!date || !details) continue;
    const near = lines.flat().filter((i) => Math.abs(i.y - date.y) <= 30);
    const find = (re: RegExp) => near.find((i) => re.test(i.str.trim()));
    const added = find(/added/i);
    const deducted = find(/deducted/i);
    const balance = find(/^balance$/i);
    if (!added || !deducted || !balance) continue;
    const band = near.filter((i) => /^(date|details|amount|added|deducted|balance|\(jod\)|amount added|amount deducted|added \(jod\)|deducted \(jod\)|amount added \(jod\)|amount deducted \(jod\))$/i.test(i.str.trim()));
    return {
      centers: { date: center(date), details: center(details), added: center(added), deducted: center(deducted), balance: center(balance) },
      top: Math.max(...band.map((i) => i.y)),
      bottom: Math.min(...band.map((i) => i.y)),
    };
  }
  return null;
}

const AMOUNT_RE = /^-?[\d,]+(\.\d{1,3})?$/;
const DATE_FRAGMENT_RE = /^\d{1,4}(-\d{0,2}){0,2}$/;

/**
 * Picks the column for one text item. Position alone isn't enough: Details text is left-aligned
 * and starts right next to the narrow Date column, so we also use what the text looks like.
 */
function columnFor(item: TextItem, c: Record<Column, number>, dateLeft: number | null): Column {
  const x = center(item);
  const str = item.str.trim();
  const dateDetails = (c.date + c.details) / 2;
  const detailsAmounts = (c.details + c.added) / 2;

  // Dates are left-aligned at the same x on every row; digits-only Details text (the tail of a
  // wrapped CliQ reference) starts further right, at the Details column's left edge.
  const inDateColumn = dateLeft !== null ? item.x < dateLeft + 15 : x < dateDetails;
  if (DATE_FRAGMENT_RE.test(str) && inDateColumn) return "date";
  if (AMOUNT_RE.test(str) && x > detailsAmounts) {
    const amountCols: Column[] = ["added", "deducted", "balance"];
    return amountCols.reduce((best, col) => (Math.abs(c[col] - x) < Math.abs(c[best] - x) ? col : best));
  }
  if (item.x < detailsAmounts) return "details";
  let best: Column = "date";
  for (const col of COLUMNS) if (Math.abs(c[col] - x) < Math.abs(c[best] - x)) best = col;
  return best;
}

/** A single text item wider than the gap between two column centers is page text (disclaimer, footer), not a table cell. */
function spansColumns(item: TextItem, centers: Record<Column, number>) {
  const covered = COLUMNS.filter((c) => centers[c] > item.x + 1 && centers[c] < item.x + item.width - 1);
  return covered.length >= 2;
}

const FOOTER_RE = /^(page\s*\d+(\s*(of|\/)\s*\d+)?|\d+\s*(of|\/)\s*\d+)$/i;

/**
 * Splits each page into preamble text and table lines. Pages without their own header
 * reuse the column positions of the last page that had one.
 */
export function layoutPages(items: TextItem[], pageCount: number): PageLayout[] {
  const pages: PageLayout[] = [];
  let lastHeader: Header | null = null;
  // Left edge of the Date column: the most common x of date starts like "2026-08-" (a date
  // printed elsewhere on the page can't outvote the dozens in the table).
  const counts = new Map<number, number>();
  for (const i of items) if (/^\d{4}-\d{2}-(\d{2})?$/.test(i.str.trim())) counts.set(Math.round(i.x), (counts.get(Math.round(i.x)) ?? 0) + 1);
  const dateLeft = counts.size ? [...counts].sort((a, b) => b[1] - a[1])[0][0] : null;

  for (let p = 1; p <= pageCount; p++) {
    const lines = groupLines(items.filter((i) => i.page === p));
    const header = findHeader(lines);
    const cols = header ?? lastHeader;
    if (header) lastHeader = header;

    const preamble: string[] = [];
    const table: TableLine[] = [];
    for (const line of lines) {
      const y = line[0].y;
      if (!cols || (header && y > header.top + LINE_TOLERANCE)) {
        preamble.push(lineText(line));
        continue;
      }
      if (header && y >= header.bottom - LINE_TOLERANCE) continue; // the header itself
      if (FOOTER_RE.test(lineText(line))) continue;

      const cells: Record<Column, string[]> = { date: [], details: [], added: [], deducted: [], balance: [] };
      let used = 0;
      for (const item of line) {
        if (spansColumns(item, cols.centers)) continue;
        cells[columnFor(item, cols.centers, dateLeft)].push(item.str.trim());
        used++;
      }
      if (!used) continue;
      table.push({
        page: p,
        y,
        cells: Object.fromEntries(COLUMNS.map((c) => [c, cells[c].join(" ").replace(/\s+/g, " ").trim()])) as Record<Column, string>,
      });
    }
    pages.push({ preamble, lines: table });
  }
  return pages;
}
