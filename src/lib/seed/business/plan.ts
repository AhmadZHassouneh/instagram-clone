// Pure planner for business chat seed data: options + random seed -> threads with messages,
// orders, invoices and payments. No database access, so it is deterministic and easy to test.
import { formatFils } from "../../statements/money";
import { BUSINESSES, fakePerson, type FakeBusiness, type FakePerson } from "../names";
import { Rng } from "../random";
import { PURCHASES, SERVICES, T, type Stage } from "./templates";

export type SeedOptions = {
  businesses: number;
  conversationsPerBusiness: number;
  from: number; // ms
  to: number; // ms
  seed: number;
  /** First name the businesses use for the developer, e.g. "أحمد". */
  ownerName: string;
};

export type PlanItem = { description: string; quantity: number; unitFils: number };

export type PlanMessage = {
  from: "owner" | "biz";
  kind: "text" | "voice" | "invoice" | "receipt";
  text: string;
  voiceSeconds: number | null;
  at: number;
  invoiceKey: string | null;
};

export type PlanInvoice = {
  key: string;
  kind: "invoice" | "receipt";
  issuer: "owner" | "biz";
  items: PlanItem[];
  totalFils: number;
  issuedAt: number;
  paidAt: number | null;
  paymentReference: string;
};

export type PlanOrder = {
  key: string;
  title: string;
  seller: "owner" | "biz";
  items: PlanItem[];
  totalFils: number;
  createdAt: number;
  updatedAt: number;
  status: "paid" | "delivered";
  invoiceKey: string;
};

export type PlanPayment = {
  at: number;
  amountFils: number;
  direction: "in" | "out";
  /** How it shows on the statement: a named transfer or a CliQ inward with only a reference. */
  via: "transfer" | "cliq_inward";
  counterpartyLatin: string | null;
  reference: string;
  invoiceKeys: string[];
};

export type PlanThread = {
  business: FakeBusiness;
  contact: FakePerson;
  alias: string;
  messages: PlanMessage[];
  orders: PlanOrder[];
  invoices: PlanInvoice[];
  payments: PlanPayment[];
  /** false = the owner hasn't read the last business message (shows as unread). */
  ownerReadAll: boolean;
  /** false = the business hasn't seen the owner's last message ("Sent" instead of "Seen"). */
  bizReadAll: boolean;
};

export type SeedPlan = { options: SeedOptions; threads: PlanThread[] };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const AMMAN_OFFSET = 3 * HOUR;
/** The owner's CliQ alias (Capital Bank) that clients are asked to pay to. */
const OWNER_CLIQ_ALIAS = "AHMADZHB";

/** Keeps messages between 9:00 and 23:30 Amman time. */
function daytime(t: number, rng: Rng) {
  const local = new Date(t + AMMAN_OFFSET);
  const h = local.getUTCHours() + local.getUTCMinutes() / 60;
  if (h >= 9 && h < 23.5) return t;
  const next = new Date(local);
  if (h >= 23.5) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(9, rng.int(0, 90), rng.int(0, 59), 0);
  return next.getTime() - AMMAN_OFFSET;
}

class Clock {
  constructor(
    public t: number,
    private rng: Rng,
  ) {}
  /** reply = minutes, later = hours, days = 1–4 days, week = 5–12 days */
  step(kind: "reply" | "later" | "days" | "week") {
    const r = this.rng;
    const delta =
      kind === "reply" ? r.int(1, 25) * MIN : kind === "later" ? r.int(2, 9) * HOUR : kind === "days" ? r.int(1, 4) * DAY + r.int(0, 8) * HOUR : r.int(5, 12) * DAY;
    this.t = daytime(this.t + delta + r.int(0, 59) * 1000, r);
    return this.t;
  }
}

const roundTo = (fils: number, step: number) => Math.max(step, Math.round(fils / step) * step);
const jod = (n: number) => n * 1000;

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** Occasionally mistype one word: double an Arabic letter or swap two Latin letters. */
function typo(text: string, rng: Rng) {
  const words = text.split(" ");
  const candidates = words.map((w, i) => [w, i] as const).filter(([w]) => w.length >= 4 && !/\d|https?:/.test(w));
  if (!candidates.length) return text;
  const [w, i] = rng.pick(candidates);
  const chars = [...w];
  const pos = rng.int(1, chars.length - 2);
  if (/[a-z]/i.test(w)) [chars[pos], chars[pos + 1]] = [chars[pos + 1], chars[pos]];
  else chars.splice(pos, 0, chars[pos]);
  words[i] = chars.join("");
  return words.join(" ");
}

const hasEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);

export function planBusinessSeed(options: SeedOptions): SeedPlan {
  const rng = new Rng(options.seed);
  if (options.businesses > BUSINESSES.length) throw new Error(`At most ${BUSINESSES.length} businesses are available.`);
  if (options.to <= options.from) throw new Error("--to must be after --from.");

  // Mix of clients and vendors (at least one vendor once there are 3+ businesses).
  const clients = BUSINESSES.filter((b) => b.role === "client");
  const vendors = BUSINESSES.filter((b) => b.role === "vendor");
  const vendorCount = Math.min(vendors.length, options.businesses >= 3 ? Math.max(1, Math.round(options.businesses * 0.35)) : 0);
  const chosen = [...rng.sample(clients, options.businesses - vendorCount), ...rng.sample(vendors, vendorCount)];

  let invoiceSeq = 0;
  let orderSeq = 0;
  const threads = chosen.map((business) =>
    business.role === "client" ? clientThread(business) : vendorThread(business),
  );
  return { options, threads };

  // ---------------------------------------------------------------------------------------
  function newThread(business: FakeBusiness): PlanThread {
    return {
      business,
      contact: fakePerson(rng),
      alias: business.role === "vendor" ? business.username.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 12) : OWNER_CLIQ_ALIAS,
      messages: [],
      orders: [],
      invoices: [],
      payments: [],
      ownerReadAll: rng.chance(0.8),
      bizReadAll: rng.chance(0.85),
    };
  }

  function episodeStarts(count: number) {
    const span = options.to - options.from;
    // Leave room at the end of the range for the episode itself (~3 weeks).
    const usable = Math.max(span - 21 * DAY, span * 0.5);
    return Array.from({ length: count }, (_, i) =>
      daytime(options.from + Math.floor(((i + rng.next() * 0.6) / count) * usable), rng),
    );
  }

  function makeSay(thread: PlanThread, clock: Clock, baseVars: Record<string, string | number>) {
    return (
      from: "owner" | "biz",
      stage: Stage | string,
      vars: Record<string, string | number> = {},
      opts: { exact?: boolean; step?: "reply" | "later" | "days" | "week" } = {},
    ) => {
      const pool = (T as Record<string, readonly string[]>)[stage];
      let text = fill(pool ? rng.pick(pool) : stage, { ...baseVars, ...vars });
      if (!opts.exact) {
        if (rng.chance(0.07)) text = typo(text, rng);
        if (rng.chance(0.12) && !hasEmoji(text)) text += " " + rng.pick(T.emojis);
      }
      thread.messages.push({ from, kind: "text", text, voiceSeconds: null, at: clock.step(opts.step ?? "reply"), invoiceKey: null });
      // Now and then the same person follows up with a voice note.
      if (!opts.exact && rng.chance(0.06)) {
        thread.messages.push({ from, kind: "voice", text: "", voiceSeconds: rng.int(4, 75), at: clock.step("reply"), invoiceKey: null });
      }
    };
  }

  function card(thread: PlanThread, clock: Clock, from: "owner" | "biz", invoice: PlanInvoice) {
    thread.messages.push({ from, kind: invoice.kind, text: "", voiceSeconds: null, at: clock.step("reply"), invoiceKey: invoice.key });
  }

  function payVia(thread: PlanThread): Pick<PlanPayment, "via" | "counterpartyLatin" | "reference"> {
    const roll = rng.next();
    const reference = rng.code(4, "ABCDEFGHJKLMNPQRSTUVWXYZ") + rng.digits(12);
    if (roll < 0.4) return { via: "transfer", counterpartyLatin: thread.business.latin, reference };
    if (roll < 0.75) return { via: "transfer", counterpartyLatin: thread.contact.latin, reference };
    return { via: "cliq_inward", counterpartyLatin: null, reference };
  }

  // ---- Scenario A: the business hires the developer --------------------------------------
  function clientThread(business: FakeBusiness): PlanThread {
    const thread = newThread(business);
    const starts = episodeStarts(options.conversationsPerBusiness);
    // Invoices delivered but not paid yet (paid together with the next one).
    let unpaid: { invoice: PlanInvoice; order: PlanOrder; dueFils: number }[] = [];

    starts.forEach((start, ep) => {
      const clock = new Clock(Math.max(start, thread.messages.at(-1)?.at ?? 0), rng);
      const service = rng.pick(SERVICES);
      const features = rng.sample(service.features, 3);
      const say = makeSay(thread, clock, {
        owner: options.ownerName,
        biz: business.nameArabic,
        contact: thread.contact.firstArabic,
        service: service.title,
        f1: features[0],
        f2: features[1] ?? features[0],
        f3: features[2] ?? features[0],
        slug: business.username.replace(/\./g, "-"),
      });

      say("biz", ep === 0 ? "request" : "repeatRequest", {}, { step: ep === 0 ? "reply" : "week" });
      say("owner", "interested", {}, { step: rng.chance(0.3) ? "later" : "reply" });
      say("biz", "requirements");
      if (rng.chance(0.7)) {
        say("owner", rng.pick(service.clarify ?? T.clarify));
        say("biz", "clarifyAnswer");
      }
      // Service-specific lines, plus the generic build-project ones where they fit.
      const progressPool = [...service.progress, ...(service.generic === false ? [] : T.progress)];
      const feedbackPool = [...service.feedback, ...(service.generic === false ? [] : T.feedback)];
      const deliveryPool = service.delivery ?? T.delivery;

      // Quote
      const items: PlanItem[] = service.items.map(([description, min, max]) => ({
        description,
        quantity: 1,
        unitFils: roundTo(jod(rng.int(min, max)), 5000) + (rng.chance(0.15) ? 500 : 0),
      }));
      const quoteFils = items.reduce((s, i) => s + i.unitFils * i.quantity, 0);
      const days = rng.int(5, 30);
      const lines = items.map((i) => `• ${i.description}: ${formatFils(i.unitFils)}`).join("\n");
      say("owner", `${rng.pick(T.quoteIntro)}\n${lines}\n${fill(rng.pick(T.quoteOutro), { total: formatFils(quoteFils), days })}`, {}, { exact: true, step: "later" });

      // Negotiation
      let finalFils = quoteFils;
      if (rng.chance(0.65)) {
        const counter = roundTo(Math.round(quoteFils * 0.8), 5000);
        say("biz", "negotiate", { counter: formatFils(counter) }, { exact: true, step: rng.chance(0.5) ? "later" : "reply" });
        const discount = roundTo(Math.round(quoteFils * (rng.int(5, 15) / 100)), 5000);
        finalFils = quoteFils - discount;
        items.push({ description: "Discount", quantity: 1, unitFils: -discount });
        say("owner", "counter", { final: formatFils(finalFils), discount: formatFils(discount) }, { exact: true });
        say("biz", "agree");
      } else {
        say("biz", "noNegotiationAgree");
      }
      const agreedAt = clock.t;

      // Deposit (bigger projects only)
      let depositFils = 0;
      if (finalFils >= jod(300) && rng.chance(0.35)) {
        depositFils = roundTo(Math.round(finalFils / 2), 1000);
        say("owner", "depositTerms", { deposit: formatFils(depositFils) }, { exact: true });
        say("biz", "depositPaid", { deposit: formatFils(depositFils) }, { exact: true, step: "later" });
        thread.payments.push({ at: clock.t, amountFils: depositFils, direction: "in", ...payVia(thread), invoiceKeys: [] });
        say("owner", "depositThanks");
      }
      say("owner", "kickoff");

      // Progress and feedback over a few days/weeks
      for (let i = 0, n = rng.int(2, 4); i < n; i++) {
        say("owner", rng.pick(progressPool), {}, { step: "days" });
        if (rng.chance(0.6)) {
          say("biz", rng.pick(feedbackPool), {}, { step: rng.chance(0.5) ? "later" : "reply" });
          say("owner", "fixAck");
        }
      }
      say("owner", rng.pick(deliveryPool), {}, { step: "days" });
      say("biz", "deliveryThanks");

      // Invoice
      const order: PlanOrder = {
        key: `O${++orderSeq}`,
        title: service.titleEn,
        seller: "owner",
        items,
        totalFils: finalFils,
        createdAt: agreedAt,
        updatedAt: clock.t,
        status: "delivered",
        invoiceKey: "",
      };
      const invoice: PlanInvoice = {
        key: `I${++invoiceSeq}`,
        kind: "invoice",
        issuer: "owner",
        items,
        totalFils: finalFils,
        issuedAt: clock.step("reply"),
        paidAt: null,
        paymentReference: "",
      };
      order.invoiceKey = invoice.key;
      thread.orders.push(order);
      thread.invoices.push(invoice);
      const dueFils = finalFils - depositFils;
      say("owner", "invoiceNote", { alias: thread.alias, due: formatFils(dueFils) }, { exact: true });
      card(thread, clock, "owner", invoice);
      // The deposit belongs to this invoice too.
      const deposit = thread.payments.find((p) => p.invoiceKeys.length === 0 && p.direction === "in");
      if (deposit) deposit.invoiceKeys.push(invoice.key);

      unpaid.push({ invoice, order, dueFils });
      const isLast = ep === starts.length - 1;
      // Sometimes a repeat client pays this invoice together with the next one.
      if (!isLast && rng.chance(0.3)) return;

      const amount = unpaid.reduce((s, u) => s + u.dueFils, 0);
      say("biz", unpaid.length > 1 ? "paidCombined" : "paid", { amount: formatFils(amount) }, { exact: true, step: rng.chance(0.6) ? "later" : "days" });
      const payment: PlanPayment = { at: clock.t, amountFils: amount, direction: "in", ...payVia(thread), invoiceKeys: unpaid.map((u) => u.invoice.key) };
      thread.payments.push(payment);
      for (const u of unpaid) {
        u.invoice.paidAt = clock.t;
        u.invoice.paymentReference = payment.reference;
        u.order.status = "paid";
        u.order.updatedAt = clock.t;
      }
      unpaid = [];
      say("owner", "paidThanks");
    });
    return thread;
  }

  // ---- Scenario B: the developer buys from a vendor ---------------------------------------
  function vendorThread(business: FakeBusiness): PlanThread {
    const thread = newThread(business);
    const catalog = PURCHASES[business.category] ?? PURCHASES["Electronics store"];
    for (const start of episodeStarts(options.conversationsPerBusiness)) {
      const clock = new Clock(Math.max(start, thread.messages.at(-1)?.at ?? 0), rng);
      const picks = rng.sample(catalog, rng.chance(0.3) ? 2 : 1);
      const items: PlanItem[] = picks.map(([description, min, max]) => ({
        description,
        quantity: business.category === "Electronics store" && rng.chance(0.2) ? 2 : 1,
        unitFils: jod(rng.int(min, max)) + rng.pick([0, 0, 500, 990, 250]),
      }));
      const total = items.reduce((s, i) => s + i.unitFils * i.quantity, 0);
      const say = makeSay(thread, clock, { item: items.map((i) => i.description).join(" و "), owner: options.ownerName });

      say("owner", "buyAsk");
      say("biz", "vendorPrice", { price: formatFils(items[0].unitFils), old: formatFils(roundTo(Math.round(items[0].unitFils * 1.2), 1000)) }, { exact: true, step: rng.chance(0.4) ? "later" : "reply" });
      if (rng.chance(0.6)) {
        say("owner", "buyQuestion");
        say("biz", "vendorAnswer");
      }
      say("owner", "buyOrder", { qty: items.map((i) => `${i.quantity} × ${i.description}`).join("، ") }, { exact: true });
      say("biz", "vendorPayInfo", { total: formatFils(total), alias: thread.alias }, { exact: true });
      say("owner", "buyPaid", { total: formatFils(total) }, { exact: true, step: rng.chance(0.5) ? "later" : "reply" });

      const reference = rng.code(4, "ABCDEFGHJKLMNPQRSTUVWXYZ") + rng.digits(12);
      const receipt: PlanInvoice = {
        key: `I${++invoiceSeq}`,
        kind: "receipt",
        issuer: "biz",
        items,
        totalFils: total,
        issuedAt: 0,
        paidAt: clock.t,
        paymentReference: reference,
      };
      thread.payments.push({ at: clock.t, amountFils: total, direction: "out", via: "transfer", counterpartyLatin: business.latin, reference, invoiceKeys: [receipt.key] });
      say("biz", "vendorConfirm");
      receipt.issuedAt = clock.t + 1000;
      card(thread, clock, "biz", receipt);
      thread.invoices.push(receipt);
      thread.orders.push({
        key: `O${++orderSeq}`,
        title: items.map((i) => i.description).join(", "),
        seller: "biz",
        items,
        totalFils: total,
        createdAt: clock.t,
        updatedAt: clock.t,
        status: "paid",
        invoiceKey: receipt.key,
      });
      if (rng.chance(0.8)) {
        say("biz", "vendorDelivery", {}, { step: "later" });
        say("owner", "buyThanks");
      }
    }
    return thread;
  }
}
