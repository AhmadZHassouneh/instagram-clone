// Builds synthetic statement rows that correspond to a seed plan's payments, plus unrelated noise
// and near-misses, so Phase 3 reconciliation can be tested end to end on fake data.
import { fakePerson } from "../names";
import { Rng } from "../random";
import type { SeedPlan } from "./plan";

export type StatementEntry = { date: string; details: string; inFils?: number; outFils?: number };

export type ExpectedRow = {
  index: number; // 1-based transaction index on the statement
  date: string;
  amountFils: number;
  direction: "in" | "out";
  /** "payment" rows pay the listed invoices; "noise" and "near_miss" rows must stay unmatched. */
  kind: "payment" | "noise" | "near_miss";
  invoiceKeys: string[];
};

const AMMAN_OFFSET = 3 * 3600_000;
const ammanDate = (t: number) => new Date(t + AMMAN_OFFSET).toISOString().slice(0, 10);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function statementFromPlan(plan: SeedPlan, seed: number) {
  const rng = new Rng(seed ^ 0x5eed);
  type Row = StatementEntry & { at: number; kind: ExpectedRow["kind"]; invoiceKeys: string[] };
  const rows: Row[] = [];

  for (const t of plan.threads) {
    for (const p of t.payments) {
      const details =
        p.direction === "out"
          ? `Money Sent to ${p.counterpartyLatin}`
          : p.via === "cliq_inward"
            ? `Cliq Inward ${p.reference}`
            : `Money Received from ${p.counterpartyLatin}`;
      rows.push({
        at: p.at,
        date: ammanDate(p.at),
        details,
        ...(p.direction === "in" ? { inFils: p.amountFils } : { outFils: p.amountFils }),
        kind: "payment",
        invoiceKeys: p.invoiceKeys,
      });
    }
  }
  const payments = rows.filter((r) => r.kind === "payment" && r.inFils);

  // Unrelated personal transfers.
  const span = plan.options.to - plan.options.from;
  for (let i = 0, n = Math.max(3, Math.round(rows.length * 0.3)); i < n; i++) {
    const at = plan.options.from + Math.floor(rng.next() * span);
    const p = fakePerson(rng);
    const fils = rng.int(5, 120) * 1000 + rng.pick([0, 500]);
    const incoming = rng.chance(0.5);
    rows.push({
      at,
      date: ammanDate(at),
      details: incoming ? `Money Received from ${p.latin}` : `Money Sent to ${p.latin}`,
      ...(incoming ? { inFils: fils } : { outFils: fils }),
      kind: "noise",
      invoiceKeys: [],
    });
  }
  // Near-misses: same amount as a real payment but weeks away, and the right payer with a wrong amount.
  for (const target of rng.sample(payments, Math.min(2, payments.length))) {
    const at = target.at + (rng.chance(0.5) ? 1 : -1) * rng.int(20, 35) * 86_400_000;
    if (at > plan.options.from && at < plan.options.to)
      rows.push({ at, date: ammanDate(at), details: `Money Received from ${fakePerson(rng).latin}`, inFils: target.inFils, kind: "near_miss", invoiceKeys: [] });
    const name = target.details.replace(/^Money Received from |^Cliq Inward .*/, "");
    if (name) {
      const at2 = target.at + rng.int(1, 2) * 86_400_000;
      rows.push({ at: at2, date: ammanDate(at2), details: `Money Received from ${name}`, inFils: target.inFils! + rng.int(7, 40) * 1000, kind: "near_miss", invoiceKeys: [] });
    }
  }

  rows.sort((a, b) => a.at - b.at);

  // Monthly interest and tax at each month end inside the range.
  const withInterest: Row[] = [];
  let month = new Date(rows[0]?.at ?? plan.options.from).getUTCMonth();
  for (const r of rows) {
    const m = new Date(r.at).getUTCMonth();
    if (m !== month) {
      const end = new Date(Date.UTC(new Date(r.at).getUTCFullYear(), m, 0, 20)).getTime();
      const interest = rng.int(100, 3000);
      withInterest.push(
        { at: end, date: ammanDate(end), details: `Interest earned for ${MONTHS[month]}`, inFils: interest, kind: "noise", invoiceKeys: [] },
        { at: end, date: ammanDate(end), details: "Tax Deduction on Profit Payment", outFils: Math.round(interest / 10), kind: "noise", invoiceKeys: [] },
      );
      month = m;
    }
    withInterest.push(r);
  }

  // Opening balance large enough that outgoing payments never go below zero.
  let bal = 0;
  let low = 0;
  for (const r of withInterest) {
    bal += (r.inFils ?? 0) - (r.outFils ?? 0);
    low = Math.min(low, bal);
  }
  const openingFils = -low + rng.int(50, 500) * 1000;

  return {
    holder: fakePerson(rng, 1).latin,
    account: rng.digits(10),
    openingFils,
    entries: withInterest.map(({ date, details, inFils, outFils }) => ({ date, details, inFils, outFils })),
    expected: withInterest.map(
      (r, i): ExpectedRow => ({
        index: i + 1,
        date: r.date,
        amountFils: r.inFils ?? r.outFils ?? 0,
        direction: r.inFils ? "in" : "out",
        kind: r.kind,
        invoiceKeys: r.invoiceKeys,
      }),
    ),
  };
}
