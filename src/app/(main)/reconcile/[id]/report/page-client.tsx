"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Printer } from "lucide-react";
import { useApi } from "@/lib/client";
import { formatFils } from "@/lib/statements/money";
import { txnStatus, type ImportView } from "@/lib/reconcile/types";
import { NotFound, Spinner } from "@/components/ui";

/**
 * Printable reconciliation report. "Save as PDF" in the print dialog produces the PDF export;
 * the browser lays out Arabic names and notes correctly, which PDF libraries without a text
 * shaping engine can't.
 */
export default function ReconcileReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApi<{ statement: ImportView }>(`/api/reconcile/${id}`);

  useEffect(() => {
    if (!data) return;
    document.title = `Reconciliation ${data.statement.periodFrom ?? ""} – ${data.statement.periodTo ?? ""}`;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [data]);

  if (error) return <NotFound />;
  if (!data)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  const s = data.statement;
  const rows = s.transactions.map((t) => ({ t, status: txnStatus(t), links: t.links.filter((l) => l.status !== "rejected") }));
  const tally = (st: string) => rows.filter((r) => r.status === st).length;

  return (
    <div className="mx-auto max-w-[1000px] bg-white p-8 text-[11px] leading-4 text-black print:p-0">
      <style>{`@page { size: A4 landscape; margin: 12mm; } @media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-[#efefef] p-3 text-sm">
        <span>Choose “Save as PDF” as the printer to export this report.</span>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-[#0095f6] px-3 py-1.5 font-semibold text-white">
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>

      <h1 className="text-xl font-bold">Reconciliation report</h1>
      <p className="mt-1 text-[12px]">
        Statement {s.periodFrom ?? "?"} → {s.periodTo ?? "?"} · Account {s.accountMasked} · Balance check:{" "}
        <b>{s.validationOk ? "passed" : "FAILED"}</b> · Generated {new Date().toLocaleString()}
      </p>
      <p className="mt-1 text-[12px]">
        Confirmed {tally("confirmed")} · Auto-matched {tally("auto-matched")} · Suggested (unconfirmed) {tally("suggested")} · Unmatched{" "}
        {tally("unmatched")} · Interest/tax {tally("not applicable")}
      </p>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            {["#", "Date", "Details", "In", "Out", "Status", "Order IDs", "Invoices", "Conf.", "Note"].map((h) => (
              <th key={h} className="px-1.5 py-1 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ t, status, links }) => (
            <tr key={t.id} className="break-inside-avoid border-b border-[#ccc] align-top">
              <td className="px-1.5 py-1">{t.idx}</td>
              <td className="whitespace-nowrap px-1.5 py-1">{t.date}</td>
              <td className="px-1.5 py-1" dir="auto">
                {t.description}
              </td>
              <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums">{t.direction === "in" ? formatFils(t.amountFils) : ""}</td>
              <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums">{t.direction === "out" ? formatFils(t.amountFils) : ""}</td>
              <td className="whitespace-nowrap px-1.5 py-1 font-semibold">{status}</td>
              <td className="px-1.5 py-1">{links.map((l) => l.orderId).join(", ")}</td>
              <td className="px-1.5 py-1">{links.flatMap((l) => l.order.invoiceNumbers).join(", ")}</td>
              <td className="px-1.5 py-1">{links.length ? `${Math.round(Math.max(...links.map((l) => l.confidence)) * 100)}%` : ""}</td>
              <td className="px-1.5 py-1" dir="auto">
                {t.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[10px] text-[#555]">
        Links are stored separately from orders; this report does not change any order, invoice or message.
      </p>
    </div>
  );
}
