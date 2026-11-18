// Shapes shared by the reconciliation API and screen (no server-only imports here).
import type { ValidationReport } from "../statements/blink/types";

export type LinkView = {
  id: number;
  orderId: number;
  amountFils: number;
  confidence: number;
  level: "auto" | "suggested";
  status: "pending" | "confirmed" | "rejected";
  reasons: string;
  confirmedBy: string | null;
  confirmedAt: number | null;
  order: {
    title: string;
    totalFils: number;
    status: string;
    createdAt: number;
    direction: "in" | "out";
    party: { name: string; username: string };
    invoiceNumbers: string[];
    conversationId: number | null;
  };
};

export type TxnView = {
  id: number;
  idx: number;
  page: number;
  date: string;
  direction: "in" | "out";
  type: string;
  counterparty: string | null;
  cliqReference: string | null;
  description: string;
  amountFils: number;
  balanceFils: number;
  note: string;
  links: LinkView[];
};

export type ImportView = {
  id: number;
  fileName: string;
  accountMasked: string;
  periodFrom: string | null;
  periodTo: string | null;
  openingFils: number | null;
  closingFils: number | null;
  validationOk: boolean;
  validation: ValidationReport;
  importedAt: number;
  transactions: TxnView[];
};

/** A transaction's match status for reports. */
export function txnStatus(t: TxnView): "confirmed" | "auto-matched" | "suggested" | "unmatched" | "not applicable" {
  if (t.type === "interest" || t.type === "tax") return "not applicable";
  const active = t.links.filter((l) => l.status !== "rejected");
  if (!active.length) return "unmatched";
  if (active.every((l) => l.status === "confirmed")) return "confirmed";
  if (active.every((l) => l.level === "auto" || l.status === "confirmed")) return "auto-matched";
  return "suggested";
}

