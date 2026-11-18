// Synthetic statement fixtures (fully fictional). Each fixture = a layout spec + the values the
// parser must produce for it. `npm run fixtures:statements` renders them to PDFs.
import { formatFils, parseFils } from "../../src/lib/statements/money";
import { fakePerson } from "../../src/lib/seed/names";
import { Rng } from "../../src/lib/seed/random";
import { buildItems, rowsFrom, type StatementSpec } from "./builder";

export type Expected = {
  rowCount: number;
  pageCount: number;
  openingFils: number;
  closingFils: number;
  totalAddedFils: number;
  totalDeductedFils: number;
  byType: Record<string, number>;
  ok: boolean;
  closingOk: boolean;
  /** Transaction indexes (1-based) whose running balance is wrong. */
  mismatchIndexes: number[];
  /** Counterparty names for transfer rows, in order (checks multi-line name joining). */
  counterparties: string[];
};

export type Fixture = { name: string; description: string; spec: StatementSpec; expected: Expected };

type Entry = {
  date: string;
  details: string;
  inFils?: number;
  outFils?: number;
  breakBeforeLine?: number;
  type: "transfer" | "cliq_inward" | "interest" | "tax";
  counterparty?: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function amount(rng: Rng, maxJod = 400) {
  return rng.int(1, maxJod) * 1000 + rng.pick([0, 0, 0, 500, 250, 750, rng.int(1, 999)]);
}

function dateAt(start: Date, dayOffset: number) {
  const d = new Date(start.getTime() + dayOffset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Random mix of transfers/CliQ rows that never takes the balance below zero. */
function randomEntries(rng: Rng, n: number, opts: { start: string; openingFils: number; extraNameParts?: number; cliqShare?: number }) {
  const entries: Entry[] = [];
  let bal = opts.openingFils;
  const start = new Date(`${opts.start}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    const date = dateAt(start, Math.floor((i * 28) / n));
    const roll = rng.next();
    if (roll < (opts.cliqShare ?? 0.15)) {
      const a = amount(rng);
      bal += a;
      entries.push({ date, details: `Cliq Inward ${rng.code(4, "ABCDEFGHJKLMNPQRSTUVWXYZ")}${rng.digits(12)}`, inFils: a, type: "cliq_inward" });
    } else if (roll < 0.6 || bal < 2000) {
      const p = fakePerson(rng, opts.extraNameParts ?? rng.int(0, 2));
      const a = amount(rng);
      bal += a;
      entries.push({ date, details: `Money Received from ${p.latin}`, inFils: a, type: "transfer", counterparty: p.latin });
    } else {
      const p = fakePerson(rng, opts.extraNameParts ?? rng.int(0, 2));
      const a = Math.min(amount(rng), bal);
      bal -= a;
      entries.push({ date, details: `Money Sent to ${p.latin}`, outFils: a, type: "transfer", counterparty: p.latin });
    }
  }
  return entries;
}

function interestAndTax(rng: Rng, date: string, month: number): Entry[] {
  const interest = rng.int(50, 4000);
  const tax = Math.round(interest / 10);
  return [
    { date, details: `Interest earned for ${MONTHS[month]}`, inFils: interest, type: "interest" },
    { date, details: "Tax Deduction on Profit Payment", outFils: tax, type: "tax" },
  ];
}

function make(
  name: string,
  description: string,
  rng: Rng,
  openingFils: number,
  entries: Entry[],
  opts: { linesPerPage?: number; footer?: boolean; breakBalanceFrom?: number; breakClosing?: boolean } = {},
): Fixture {
  const holder = fakePerson(rng, 1).latin;
  const rows = rowsFrom(openingFils, entries);
  const first = entries[0]?.date ?? "2026-01-01";
  const last = entries.at(-1)?.date ?? first;

  const added = entries.reduce((s, e) => s + (e.inFils ?? 0), 0);
  const deducted = entries.reduce((s, e) => s + (e.outFils ?? 0), 0);
  let closing = openingFils + added - deducted;
  const mismatchIndexes: number[] = [];

  // A broken row: from transaction k on, every printed balance (and the closing) is off by 1.000.
  if (opts.breakBalanceFrom) {
    for (let i = opts.breakBalanceFrom; i < rows.length; i++) rows[i].balance = formatFils(parseFils(rows[i].balance) + 1000);
    closing += 1000;
    mismatchIndexes.push(opts.breakBalanceFrom);
  }
  if (opts.breakClosing) {
    closing += 5;
    rows.at(-1)!.balance = formatFils(closing);
  }

  const spec: StatementSpec = {
    issueDate: "2026/10/01",
    holder,
    account: rng.digits(10),
    periodFrom: first,
    periodTo: last,
    rows,
    linesPerPage: opts.linesPerPage,
    footer: opts.footer,
  };
  const byType: Record<string, number> = {};
  for (const e of entries) byType[e.type] = (byType[e.type] ?? 0) + 1;
  const closingOk = !opts.breakBalanceFrom && !opts.breakClosing;

  return {
    name,
    description,
    spec,
    expected: {
      rowCount: entries.length,
      pageCount: buildItems(spec).pageCount,
      openingFils,
      closingFils: closing,
      totalAddedFils: added,
      totalDeductedFils: deducted,
      byType,
      ok: closingOk && mismatchIndexes.length === 0,
      closingOk,
      mismatchIndexes,
      counterparties: entries.filter((e) => e.counterparty).map((e) => e.counterparty!),
    },
  };
}

export function buildFixtures(seed = 2026): Fixture[] {
  const rng = new Rng(seed);
  const fixtures: Fixture[] = [];

  fixtures.push(make("01-basic", "25 mixed rows on one or two pages", rng, 12_500, randomEntries(rng, 25, { start: "2026-03-01", openingFils: 12_500 })));

  {
    // Long-name rows forced to break after line 1, 2 and 3.
    const entries = randomEntries(rng, 12, { start: "2026-04-01", openingFils: 0, extraNameParts: 2, cliqShare: 0 });
    entries[3].breakBeforeLine = 1;
    entries[6].breakBeforeLine = 2;
    entries[9].breakBeforeLine = 3;
    fixtures.push(make("02-page-break-mid-row", "rows split across pages after the 1st, 2nd and 3rd line", rng, 0, entries));
  }

  {
    const entries = randomEntries(rng, 15, { start: "2026-05-01", openingFils: 3_000, extraNameParts: 4, cliqShare: 0 });
    entries[7].breakBeforeLine = 2;
    fixtures.push(make("03-long-names", "6-word names that wrap onto 3-4 lines, one across a page break", rng, 3_000, entries));
  }

  {
    const p = fakePerson(rng);
    const q = fakePerson(rng);
    const entries: Entry[] = [
      { date: "2026-06-02", details: `Money Received from ${p.latin}`, inFils: 75_250, type: "transfer", counterparty: p.latin },
      { date: "2026-06-03", details: `Money Sent to ${q.latin}`, outFils: 75_250, type: "transfer", counterparty: q.latin },
      { date: "2026-06-10", details: `Cliq Inward ${rng.code(4)}${rng.digits(12)}`, inFils: 10_005, type: "cliq_inward" },
      { date: "2026-06-11", details: `Money Sent to ${p.latin}`, outFils: 10_005, type: "transfer", counterparty: p.latin },
    ];
    fixtures.push(make("04-zero-balance", "balance starts at, returns to and ends at 0.000", rng, 0, entries));
  }

  {
    const entries = randomEntries(rng, 130, { start: "2026-01-01", openingFils: 50_000 });
    fixtures.push(make("05-large-130-rows", "130 rows over several pages with footers and disclaimers", rng, 50_000, entries, { footer: true }));
  }

  {
    const entries: Entry[] = [];
    for (let m = 6; m <= 8; m++) {
      const month = randomEntries(rng, 8, { start: `2026-${String(m + 1).padStart(2, "0")}-01`, openingFils: 100_000, cliqShare: 0.6 });
      entries.push(...month, ...interestAndTax(rng, month.at(-1)!.date, m));
    }
    // A CliQ reference long enough to wrap onto a second line.
    entries.splice(4, 0, { date: entries[3].date, details: `Cliq Inward ${rng.code(10)}${rng.digits(20)}`, inFils: 1_000, type: "cliq_inward" });
    fixtures.push(make("06-cliq-interest-tax", "CliQ inward rows, monthly interest and tax deductions", rng, 100_000, entries));
  }

  fixtures.push(
    make("07-broken-balance", "row 9's balance is 1.000 too high, carried to the end (must be reported)", rng, 20_000,
      randomEntries(rng, 20, { start: "2026-07-01", openingFils: 20_000 }), { breakBalanceFrom: 9 }),
  );

  fixtures.push(
    make("08-broken-closing", "all rows fine but the printed closing balance is 0.005 off", rng, 8_000,
      randomEntries(rng, 10, { start: "2026-08-01", openingFils: 8_000 }), { breakClosing: true }),
  );

  return fixtures;
}
