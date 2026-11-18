import { describe, expect, it } from "vitest";
import { matchTransactions, type MatchOrder, type MatchTxn } from "../../src/lib/reconcile/match";

// Fictional data only.
const at = (iso: string) => Date.parse(`${iso}T12:00:00+03:00`);
let nextId = 1;
const txn = (p: Partial<MatchTxn> & Pick<MatchTxn, "date" | "amountFils">): MatchTxn => ({
  id: nextId++,
  direction: "in",
  type: "transfer",
  counterparty: null,
  cliqReference: null,
  ...p,
});
const order = (p: Partial<MatchOrder> & Pick<MatchOrder, "remainingFils" | "dates">): MatchOrder => ({
  id: nextId++,
  direction: "in",
  partyId: 1,
  names: ["Sahtein Kitchen", "sahtein.kitchen", "مطبخ صحتين"],
  references: [],
  ...p,
});

describe("matchTransactions", () => {
  it("auto-matches exact amount + same day + matching name", () => {
    const t = txn({ date: "2026-06-10", amountFils: 125000, counterparty: "SAHTEIN KITCHEN" });
    const o = order({ remainingFils: 125000, dates: [at("2026-06-10")] });
    const [link, ...rest] = matchTransactions([t], [o]);
    expect(rest).toEqual([]);
    expect(link).toMatchObject({ transactionId: t.id, orderId: o.id, amountFils: 125000, level: "auto" });
  });

  it("matches Arabic order names to Latin payer names", () => {
    const t = txn({ date: "2026-06-10", amountFils: 50000, counterparty: "RAMI SAMIR NASSAR" });
    const o = order({ remainingFils: 50000, dates: [at("2026-06-09")], names: ["رامي سمير نصار"] });
    expect(matchTransactions([t], [o])[0]?.level).toBe("auto");
  });

  it("only suggests when the payer name is unknown (CliQ inward) or different", () => {
    const cliq = txn({ date: "2026-06-10", amountFils: 70000, type: "cliq_inward", cliqReference: "ABCD123412341234" });
    const other = txn({ date: "2026-06-11", amountFils: 80000, counterparty: "SOMEONE ELSE ENTIRELY" });
    const o1 = order({ remainingFils: 70000, dates: [at("2026-06-10")] });
    const o2 = order({ remainingFils: 80000, dates: [at("2026-06-11")] });
    const links = matchTransactions([cliq, other], [o1, o2]);
    expect(links.find((l) => l.transactionId === cliq.id)?.level).toBe("suggested");
    expect(links.find((l) => l.transactionId === other.id)?.level).toBe("suggested");
  });

  it("auto-matches a CliQ inward row whose reference is on the invoice", () => {
    const t = txn({ date: "2026-06-10", amountFils: 70000, type: "cliq_inward", cliqReference: "ABCD123412341234" });
    const o = order({ remainingFils: 70000, dates: [at("2026-06-12")], references: ["ABCD123412341234"] });
    expect(matchTransactions([t], [o])[0]).toMatchObject({ level: "auto" });
  });

  it("respects the date window", () => {
    const t = txn({ date: "2026-06-20", amountFils: 30000, counterparty: "SAHTEIN KITCHEN" });
    const o = order({ remainingFils: 30000, dates: [at("2026-06-10")] });
    expect(matchTransactions([t], [o])).toEqual([]);
    expect(matchTransactions([t], [o], { windowDays: 10 })).toHaveLength(1);
  });

  it("never matches across directions or on a different amount", () => {
    const t = txn({ date: "2026-06-10", amountFils: 30000, counterparty: "SAHTEIN KITCHEN", direction: "out" });
    const o = order({ remainingFils: 30000, dates: [at("2026-06-10")] });
    const o2 = order({ remainingFils: 30001, dates: [at("2026-06-10")], direction: "out" });
    expect(matchTransactions([t], [o, o2])).toEqual([]);
  });

  it("links one transfer to several orders of the same party", () => {
    const t = txn({ date: "2026-07-01", amountFils: 300000, counterparty: "SAHTEIN KITCHEN" });
    const a = order({ remainingFils: 120000, dates: [at("2026-06-30")] });
    const b = order({ remainingFils: 180000, dates: [at("2026-07-01")] });
    const otherParty = order({ remainingFils: 180000, dates: [at("2026-07-01")], partyId: 2, names: ["Lamsa Furniture"] });
    const links = matchTransactions([t], [a, b, otherParty]);
    expect(links.map((l) => [l.orderId, l.amountFils]).sort()).toEqual([[a.id, 120000], [b.id, 180000]].sort());
    expect(new Set(links.map((l) => l.transactionId))).toEqual(new Set([t.id]));
  });

  it("links several transfers (deposit + balance) to one order", () => {
    const deposit = txn({ date: "2026-06-01", amountFils: 250000, counterparty: "SAHTEIN KITCHEN" });
    const rest = txn({ date: "2026-06-25", amountFils: 250000, counterparty: "SAHTEIN KITCHEN" });
    const o = order({ remainingFils: 500000, dates: [at("2026-06-01"), at("2026-06-24"), at("2026-06-25")] });
    const links = matchTransactions([deposit, rest], [o]);
    expect(links.map((l) => [l.transactionId, l.amountFils])).toEqual(
      expect.arrayContaining([[deposit.id, 250000], [rest.id, 250000]]),
    );
    expect(links.every((l) => l.orderId === o.id)).toBe(true);
  });

  it("splits two transfers across two orders of one party (deposit on B, then A + rest of B)", () => {
    const party = { partyId: 9, names: ["Lamsa Furniture"] };
    const a = order({ ...party, remainingFils: 100000, dates: [at("2026-08-01"), at("2026-08-20")] });
    const b = order({ ...party, remainingFils: 400000, dates: [at("2026-08-05"), at("2026-08-21")] });
    const deposit = txn({ date: "2026-08-05", amountFils: 200000, counterparty: "LAMSA FURNITURE CO" });
    const both = txn({ date: "2026-08-21", amountFils: 300000, counterparty: "LAMSA FURNITURE CO" });
    const links = matchTransactions([deposit, both], [a, b]);
    expect(links.map((l) => [l.transactionId, l.orderId, l.amountFils]).sort()).toEqual(
      [
        [deposit.id, b.id, 200000],
        [both.id, b.id, 200000],
        [both.id, a.id, 100000],
      ].sort(),
    );
    // Every allocation still adds up: each order fully covered, each transfer fully used.
    const byOrder = (id: number) => links.filter((l) => l.orderId === id).reduce((s, l) => s + l.amountFils, 0);
    expect([byOrder(a.id), byOrder(b.id)]).toEqual([100000, 400000]);
  });

  it("downgrades to suggested when two orders fit equally well", () => {
    const t = txn({ date: "2026-06-10", amountFils: 40000, counterparty: "SAHTEIN KITCHEN" });
    const a = order({ remainingFils: 40000, dates: [at("2026-06-10")] });
    const b = order({ remainingFils: 40000, dates: [at("2026-06-10")] });
    const links = matchTransactions([t], [a, b]);
    expect(links).toHaveLength(1);
    expect(links[0].level).toBe("suggested");
  });

  it("never proposes a pair the user rejected", () => {
    const t = txn({ date: "2026-06-10", amountFils: 40000, counterparty: "SAHTEIN KITCHEN" });
    const o = order({ remainingFils: 40000, dates: [at("2026-06-10")] });
    expect(matchTransactions([t], [o], { rejected: new Set([`${t.id}:${o.id}`]) })).toEqual([]);
  });

  it("ignores interest and tax rows", () => {
    const t = txn({ date: "2026-06-30", amountFils: 2000, type: "interest" });
    const o = order({ remainingFils: 2000, dates: [at("2026-06-30")] });
    expect(matchTransactions([t], [o])).toEqual([]);
  });
});
