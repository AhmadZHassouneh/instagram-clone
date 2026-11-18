"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CircleAlert, CircleCheck, FileUp, ShieldCheck } from "lucide-react";
import { api, timeAgo, useApi } from "@/lib/client";
import { useApp } from "@/components/app-context";
import { PrimaryButton, Spinner } from "@/components/ui";

type ImportRow = {
  id: number;
  fileName: string;
  accountMasked: string;
  periodFrom: string | null;
  periodTo: string | null;
  validationOk: boolean;
  importedAt: number;
  transactions: number;
  linked: number;
};

export default function ReconcileListPage() {
  const { data } = useApi<{ imports: ImportRow[] }>("/api/reconcile");
  const { toast } = useApp();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [windowDays, setWindowDays] = useState(3);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("windowDays", String(windowDays));
      const r = await api<{ importId: number; existing: boolean; proposed: number }>("/api/reconcile", { body: fd });
      toast(r.existing ? "This statement was already imported." : `Imported. ${r.proposed} possible matches found.`);
      router.push(`/reconcile/${r.importId}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold">Reconciliation</h1>
      <p className="mt-1 text-muted">
        Match the transfers on a bank statement to your orders. This only links and reports; your orders, invoices and
        messages are never changed.
      </p>

      <div
        className="mt-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files[0]);
        }}
      >
        {busy ? <Spinner /> : <FileUp size={40} strokeWidth={1.2} />}
        <p className="font-semibold">{busy ? "Reading statement…" : "Drop a Blink statement PDF here"}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <PrimaryButton disabled={busy} onClick={() => input.current?.click()}>
            Choose PDF
          </PrimaryButton>
          <label className="flex items-center gap-2 text-sm text-muted">
            Date window
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="rounded-md border border-border bg-bg px-2 py-1 text-fg"
            >
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <option key={d} value={d}>
                  ±{d} days
                </option>
              ))}
            </select>
          </label>
        </div>
        <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={14} /> The PDF is read on this server and not kept; only the parsed rows are stored.
        </p>
      </div>

      <h2 className="mb-2 mt-10 font-semibold">Imported statements</h2>
      {!data ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : data.imports.length === 0 ? (
        <p className="text-muted">Nothing imported yet.</p>
      ) : (
        <div className="divide-y divide-separator rounded-xl border border-separator">
          {data.imports.map((i) => (
            <Link key={i.id} href={`/reconcile/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-hover">
              {i.validationOk ? (
                <CircleCheck size={20} className="shrink-0 text-[#1a7f37]" />
              ) : (
                <CircleAlert size={20} className="shrink-0 text-danger" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {i.periodFrom ?? "?"} → {i.periodTo ?? "?"} <span className="font-normal text-muted">· {i.accountMasked}</span>
                </div>
                <div className="truncate text-xs text-muted">
                  {i.fileName} · imported {timeAgo(i.importedAt, true)}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="font-semibold">
                  {i.linked}/{i.transactions}
                </div>
                <div className="text-muted">linked</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
