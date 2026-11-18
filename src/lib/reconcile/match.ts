// Pure matching engine: statement transactions × existing orders -> proposed links.
// It never decides anything about records it isn't given and has no side effects.
import { bestNameSimilarity } from "./names";

export type MatchTxn = {
  id: number;
  date: string; // YYYY-MM-DD (statement date)
  direction: "in" | "out";
  type: string;
  amountFils: number;
  counterparty: string | null;
  cliqReference: string | null;
};

export type MatchOrder = {
  id: number;
  /** "in" = you are the seller (money comes to you), "out" = you are the buyer. */
  direction: "in" | "out";
  /** The other party (a transfer can only be split across orders of one party). */
  partyId: number;
  /** Amount still unaccounted for (total minus amounts already linked). */
  remainingFils: number;
  /** Dates a payment can sit next to: order created, invoice issued, invoice paid (ms). */
  dates: number[];
  /** Names the other party might pay under: display name, username, Arabic name... */
  names: string[];
  /** Payment references recorded on the order's invoices. */
  references: string[];
};

export type MatchOptions = {
  /** Max days between a transfer and the nearest date of the order it's allocated to. */
  windowDays: number;
  autoThreshold: number;
  suggestThreshold: number;
  /** Pairs the user rejected: never propose them again. Key: `${txnId}:${orderId}` */
  rejected?: Set<string>;
};

export const DEFAULT_OPTIONS: MatchOptions = { windowDays: 3, autoThreshold: 0.85, suggestThreshold: 0.55 };

export type ProposedLink = {
  transactionId: number;
  orderId: number;
  amountFils: number;
  confidence: number;
  level: "auto" | "suggested";
  reasons: string[];
};

/** One allocation: this much of transfer t pays order o. */
type Pair = { t: MatchTxn; o: MatchOrder; amount: number };
type Group = { pairs: Pair[]; txns: MatchTxn[]; orders: MatchOrder[]; confidence: number; reasons: string[] };

const AMMAN_OFFSET = 3 * 3600_000;
const dayOfDate = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
const dayOfMs = (ms: number) => Math.floor((ms + AMMAN_OFFSET) / 86_400_000);
const MATCHABLE = new Set(["transfer", "cliq_inward", "other"]);
const uniq = <T>(xs: T[]) => [...new Set(xs)];

function dayGap(t: MatchTxn, o: MatchOrder) {
  const d = dayOfDate(t.date);
  return Math.min(...o.dates.map((ms) => Math.abs(d - dayOfMs(ms))));
}

function combinations<T>(items: T[], k: number, max = 4000): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (out.length >= max) return;
    if (acc.length === k) return void out.push(acc);
    for (let i = start; i < items.length; i++) rec(i + 1, [...acc, items[i]]);
  };
  rec(0, []);
  return out;
}

/** Confidence for a set of allocations whose amounts already add up exactly. */
function score(pairs: Pair[], opts: MatchOptions): Group | null {
  const txns = uniq(pairs.map((p) => p.t));
  const orders = uniq(pairs.map((p) => p.o));
  const worstGap = Math.max(...pairs.map((p) => dayGap(p.t, p.o)));
  if (worstGap > opts.windowDays) return null;
  const dateScore = 1 - worstGap / (opts.windowDays + 1);

  const named = pairs.filter((p) => p.t.counterparty);
  const nameScore = named.length ? Math.min(...named.map((p) => bestNameSimilarity(p.t.counterparty, p.o.names))) : null;
  const refMatch = pairs.some((p) => p.t.cliqReference && p.o.references.includes(p.t.cliqReference));

  const reasons = [
    txns.length > 1 && orders.length > 1
      ? `${txns.length} transfers cover ${orders.length} orders`
      : txns.length > 1
        ? `${txns.length} transfers add up to the order total`
        : orders.length > 1
          ? `one transfer covers ${orders.length} orders`
          : "exact amount",
    worstGap === 0 ? "same day" : `${worstGap} day${worstGap === 1 ? "" : "s"} apart`,
    nameScore !== null ? `name ${Math.round(nameScore * 100)}% similar` : "no payer name on statement",
  ];

  // amount 0.4 (always exact here) + date 0.2 + name 0.4 (unknown name counts as weak evidence)
  let confidence = 0.4 + 0.2 * dateScore + 0.4 * (nameScore ?? 0.25);
  if (refMatch) {
    confidence = Math.max(confidence, 0.97);
    reasons.push("CliQ reference matches the invoice");
  }
  if (pairs.length > 1) confidence *= txns.length > 1 && orders.length > 1 ? 0.9 : 0.95; // splits/combos are less certain
  return { pairs, txns, orders, confidence: Math.min(1, confidence), reasons };
}

export function matchTransactions(transactions: MatchTxn[], orders: MatchOrder[], options: Partial<MatchOptions> = {}): ProposedLink[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rejected = opts.rejected ?? new Set<string>();
  const txns = transactions.filter((t) => MATCHABLE.has(t.type) && t.amountFils > 0);
  const open = orders.filter((o) => o.remainingFils > 0);
  const groups: Group[] = [];
  const add = (pairs: Pair[]) => {
    if (pairs.some((p) => p.amount <= 0 || rejected.has(`${p.t.id}:${p.o.id}`))) return;
    const g = score(pairs, opts);
    if (g && g.confidence >= opts.suggestThreshold) groups.push(g);
  };
  const near = (t: MatchTxn, o: MatchOrder) => o.direction === t.direction && dayGap(t, o) <= opts.windowDays;
  const sameDirection = (t: MatchTxn, o: MatchOrder) => o.direction === t.direction;

  for (const t of txns) {
    const nearby = open.filter((o) => near(t, o));
    // 1 transfer -> 1 order
    for (const o of nearby) if (o.remainingFils === t.amountFils) add([{ t, o, amount: t.amountFils }]);
    // 1 transfer -> 2-3 orders of the same party
    const smaller = nearby.filter((o) => o.remainingFils < t.amountFils);
    for (const k of [2, 3]) {
      for (const combo of combinations(smaller, k)) {
        if (new Set(combo.map((o) => o.partyId)).size !== 1) continue;
        if (combo.reduce((s, o) => s + o.remainingFils, 0) === t.amountFils) add(combo.map((o) => ({ t, o, amount: o.remainingFils })));
      }
    }
  }
  for (const o of open) {
    // 2-3 transfers -> 1 order (deposit + balance, instalments)
    const nearby = txns.filter((t) => near(t, o) && t.amountFils < o.remainingFils);
    for (const k of [2, 3]) {
      for (const combo of combinations(nearby, k)) {
        if (combo.reduce((s, t) => s + t.amountFils, 0) === o.remainingFils) add(combo.map((t) => ({ t, o, amount: t.amountFils })));
      }
    }
  }
  // 2 transfers -> 2 orders of one party, e.g. a deposit on order B, then one transfer paying
  // order A plus the rest of B. One transfer goes wholly to one order; the other covers the rest.
  for (const [a, b] of combinations(open, 2)) {
    if (a.partyId !== b.partyId || a.direction !== b.direction) continue;
    const total = a.remainingFils + b.remainingFils;
    const cands = txns.filter((t) => sameDirection(t, a) && (near(t, a) || near(t, b)) && t.amountFils < total);
    for (const [t1, t2] of combinations(cands, 2)) {
      if (t1.amountFils + t2.amountFils !== total) continue;
      for (const [whole, rest] of [[t1, t2], [t2, t1]]) {
        for (const [x, y] of [[a, b], [b, a]]) {
          // `whole` pays part of x; `rest` pays the remainder of x and all of y.
          if (whole.amountFils >= x.remainingFils) continue;
          add([
            { t: whole, o: x, amount: whole.amountFils },
            { t: rest, o: x, amount: x.remainingFils - whole.amountFils },
            { t: rest, o: y, amount: y.remainingFils },
          ]);
        }
      }
    }
  }

  // Greedy: best groups first; a transfer or order is used by at most one group.
  groups.sort((g, h) => h.confidence - g.confidence || g.pairs.length - h.pairs.length);
  const usedT = new Set<number>();
  const usedO = new Set<number>();
  const accepted: Group[] = [];
  for (const g of groups) {
    if (g.txns.some((t) => usedT.has(t.id)) || g.orders.some((o) => usedO.has(o.id))) continue;
    accepted.push(g);
    g.txns.forEach((t) => usedT.add(t.id));
    g.orders.forEach((o) => usedO.add(o.id));
  }

  const links: ProposedLink[] = [];
  for (const g of accepted) {
    // A close runner-up competing for the same transfer or order makes this only a suggestion
    // (alternative splits of the very same transfers and orders don't count as rivals).
    const sameSets = (h: Group) =>
      h.txns.length === g.txns.length && h.orders.length === g.orders.length && h.txns.every((t) => g.txns.includes(t)) && h.orders.every((o) => g.orders.includes(o));
    const rival = groups.find(
      (h) => h !== g && !sameSets(h) && h.confidence >= g.confidence - 0.1 && (h.txns.some((t) => g.txns.includes(t)) || h.orders.some((o) => g.orders.includes(o))),
    );
    const reasons = rival ? [...g.reasons, "another order/transfer fits almost as well"] : g.reasons;
    const level = g.confidence >= opts.autoThreshold && !rival ? "auto" : "suggested";
    const confidence = Math.round(g.confidence * 1000) / 1000;
    for (const p of g.pairs) links.push({ transactionId: p.t.id, orderId: p.o.id, amountFils: p.amount, confidence, level, reasons });
  }
  return links;
}
