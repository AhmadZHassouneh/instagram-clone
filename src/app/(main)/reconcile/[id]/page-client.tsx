"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronLeft, CircleAlert, CircleCheck, Download, FileText, RotateCcw, Trash2, X } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { formatFils } from "@/lib/statements/money";
import { txnStatus, type ImportView, type LinkView, type TxnView } from "@/lib/reconcile/types";
import { useApp } from "@/components/app-context";
import { NotFound, OptionsMenu, SecondaryButton, Spinner } from "@/components/ui";

type Filter = "review" | "matched" | "unmatched" | "all";

const STATUS_STYLE: Record<ReturnType<typeof txnStatus>, string> = {
  confirmed: "bg-[#e7f6ec] text-[#1a7f37] dark:bg-[#12361f] dark:text-[#5fd17f]",
  "auto-matched": "bg-[#e0f1ff] text-[#0064c8] dark:bg-[#0b2a45] dark:text-[#7cc4ff]",
  suggested: "bg-[#fff4d6] text-[#8a5a00] dark:bg-[#3a2c05] dark:text-[#f5c451]",
  unmatched: "bg-secondary text-muted",
  "not applicable": "bg-secondary text-muted",
};

function LinkRow({ link, onDecide }: { link: LinkView; onDecide: (decision: "confirmed" | "rejected" | "pending") => void }) {
  const o = link.order;
  const rejected = link.status === "rejected";
  return (
    <div className={`rounded-xl border border-separator p-3 ${rejected ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            Order #{link.orderId} · {o.title}
          </div>
          <div className="text-xs text-muted">
            {o.direction === "in" ? "From" : "To"}{" "}
            {o.conversationId ? (
              <Link href={`/direct/t/${o.conversationId}`} className="font-semibold text-fg hover:underline">
                {o.party.name || o.party.username}
              </Link>
            ) : (
              <span className="font-semibold text-fg">{o.party.name || o.party.username}</span>
            )}
            {o.invoiceNumbers.length > 0 && <> · {o.invoiceNumbers.join(", ")}</>} · total {formatFils(o.totalFils)} JOD
            {link.amountFils !== o.totalFils && <> · this transfer: {formatFils(link.amountFils)}</>}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            link.level === "auto" ? STATUS_STYLE["auto-matched"] : STATUS_STYLE.suggested
          }`}
          title={link.reasons}
        >
          {link.level === "auto" ? "AUTO" : "SUGGESTED"} · {Math.round(link.confidence * 100)}%
        </span>
      </div>
      <div className="mt-1 text-xs text-muted">{link.reasons}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {link.status === "pending" ? (
          <>
            <button onClick={() => onDecide("confirmed")} className="flex items-center gap-1 rounded-lg bg-link px-3 py-1 font-semibold text-white hover:bg-link-hover">
              <Check size={14} /> Confirm
            </button>
            <button onClick={() => onDecide("rejected")} className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1 font-semibold hover:bg-secondary-hover">
              <X size={14} /> Reject
            </button>
          </>
        ) : (
          <>
            <span className={`font-semibold ${link.status === "confirmed" ? "text-[#1a7f37] dark:text-[#5fd17f]" : "text-danger"}`}>
              {link.status === "confirmed" ? "Confirmed" : "Rejected"}
            </span>
            <span className="text-xs text-muted">
              by @{link.confirmedBy} · {link.confirmedAt ? new Date(link.confirmedAt).toLocaleString() : ""}
            </span>
            <button onClick={() => onDecide("pending")} className="flex items-center gap-1 text-xs font-semibold text-link">
              <RotateCcw size={12} /> Undo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NoteField({ txn, onSaved }: { txn: TxnView; onSaved: (note: string) => void }) {
  const [note, setNote] = useState(txn.note);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const save = async () => {
    if (note === txn.note) return;
    setState("saving");
    await api(`/api/reconcile/transactions/${txn.id}`, { method: "PATCH", body: { note } });
    onSaved(note);
    setState("saved");
  };
  return (
    <div className="mt-2">
      <textarea
        dir="auto"
        value={note}
        onChange={(e) => {
          setNote(e.target.value.slice(0, 1000));
          setState("idle");
        }}
        onBlur={save}
        rows={2}
        placeholder="Your note (optional) — e.g. what this transfer was for"
        className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-fg/40"
      />
      <div className="h-4 text-right text-xs text-muted">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}</div>
    </div>
  );
}

function TxnCard({ txn, onChange }: { txn: TxnView; onChange: () => void }) {
  const { toast } = useApp();
  const status = txnStatus(txn);
  const decide = async (link: LinkView, decision: "confirmed" | "rejected" | "pending") => {
    try {
      await api(`/api/reconcile/links/${link.id}`, { body: { decision } });
      onChange();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const incoming = txn.direction === "in";
  return (
    <div className="rounded-2xl border border-separator p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 rounded-full p-1.5 ${incoming ? "bg-[#e7f6ec] text-[#1a7f37] dark:bg-[#12361f]" : "bg-[#fde8e8] text-[#b42318] dark:bg-[#3b1212]"}`}>
          {incoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={`text-base font-bold tabular-nums ${incoming ? "text-[#1a7f37] dark:text-[#5fd17f]" : ""}`}>
              {incoming ? "+" : "−"}
              {formatFils(txn.amountFils)} JOD
            </span>
            <span className="text-xs text-muted">
              {txn.date} · row {txn.idx} · page {txn.page}
            </span>
          </div>
          <div className="truncate" dir="auto">
            {txn.counterparty ?? (txn.cliqReference ? `CliQ inward · ${txn.cliqReference}` : txn.description)}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_STYLE[status]}`}>{status}</span>
      </div>
      {txn.links.length > 0 && (
        <div className="mt-3 space-y-2">
          {txn.links.map((l) => (
            <LinkRow key={l.id} link={l} onDecide={(d) => decide(l, d)} />
          ))}
        </div>
      )}
      {status === "unmatched" && <NoteField txn={txn} onSaved={onChange} />}
      {status !== "unmatched" && txn.note && <p className="mt-2 text-sm text-muted" dir="auto">📝 {txn.note}</p>}
    </div>
  );
}

export default function ReconcileImportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useApp();
  const { data, error, reload } = useApi<{ statement: ImportView }>(`/api/reconcile/${id}`);
  const [filter, setFilter] = useState<Filter>("review");
  const [windowDays, setWindowDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (error) return <NotFound />;
  if (!data)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  const s = data.statement;
  const statuses = s.transactions.map((t) => [t, txnStatus(t)] as const);
  const count = (st: ReturnType<typeof txnStatus>) => statuses.filter(([, x]) => x === st).length;
  const shown = statuses
    .filter(([, st]) =>
      filter === "all"
        ? true
        : filter === "review"
          ? st === "suggested" || st === "auto-matched"
          : filter === "matched"
            ? st === "confirmed" || st === "auto-matched"
            : st === "unmatched",
    )
    .map(([t]) => t);

  const rematch = async () => {
    setBusy(true);
    try {
      const r = await api<{ proposed: number }>(`/api/reconcile/${id}/match`, { body: { windowDays } });
      toast(r.proposed ? `${r.proposed} new possible matches.` : "No new matches found.");
      reload();
    } finally {
      setBusy(false);
    }
  };

  const tabs: [Filter, string, number][] = [
    ["review", "To review", count("suggested") + count("auto-matched")],
    ["matched", "Matched", count("confirmed") + count("auto-matched")],
    ["unmatched", "Unmatched", count("unmatched")],
    ["all", "All", s.transactions.length],
  ];

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:py-10">
      <Link href="/reconcile" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft size={16} /> Statements
      </Link>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">
            {s.periodFrom ?? "?"} → {s.periodTo ?? "?"}
          </h1>
          <p className="text-muted">
            Account {s.accountMasked} · {s.fileName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/reconcile/${id}/export`} className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-[7px] text-sm font-semibold hover:bg-secondary-hover">
            <Download size={16} /> CSV
          </a>
          <Link href={`/reconcile/${id}/report`} target="_blank" className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-[7px] text-sm font-semibold hover:bg-secondary-hover">
            <FileText size={16} /> PDF
          </Link>
          <SecondaryButton onClick={() => setConfirmDelete(true)} className="px-3" aria-label="Delete statement">
            <Trash2 size={16} />
          </SecondaryButton>
        </div>
      </div>

      <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${s.validationOk ? "bg-[#e7f6ec] dark:bg-[#12361f]" : "bg-[#fde8e8] dark:bg-[#3b1212]"}`}>
        {s.validationOk ? <CircleCheck size={18} className="shrink-0 text-[#1a7f37]" /> : <CircleAlert size={18} className="shrink-0 text-danger" />}
        <div>
          {s.validationOk ? (
            <>Balances check out: opening + added − deducted = closing, and every running balance matches.</>
          ) : (
            <>
              <b>The statement didn&apos;t pass the balance checks.</b>{" "}
              {s.validation.rowMismatches.length > 0 && <>Rows with a wrong running balance: {s.validation.rowMismatches.map((m) => m.index).join(", ")}. </>}
              {!s.validation.closing.ok && <>The closing balance doesn&apos;t add up. </>}
              Matches on this statement may be unreliable.
            </>
          )}
          {s.validation.warnings.length > 0 && <div className="mt-1 text-xs text-muted">{s.validation.warnings.length} warning(s) while reading the PDF.</div>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
        {(["confirmed", "auto-matched", "suggested", "unmatched", "not applicable"] as const).map((st) => (
          <div key={st} className="rounded-xl border border-separator p-2">
            <div className="text-xl font-bold">{count(st)}</div>
            <div className="text-xs capitalize text-muted">{st}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-separator">
        {tabs.map(([f, label, n]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${filter === f ? "border-fg" : "border-transparent text-muted"}`}
          >
            {label} <span className="text-muted">{n}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1 text-sm">
          <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className="rounded-md border border-border bg-bg px-2 py-1">
            {[1, 2, 3, 5, 7, 14].map((d) => (
              <option key={d} value={d}>
                ±{d} days
              </option>
            ))}
          </select>
          <button onClick={rematch} disabled={busy} className="font-semibold text-link disabled:opacity-50">
            {busy ? "Matching…" : "Find more matches"}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {shown.length === 0 ? (
          <p className="py-10 text-center text-muted">Nothing here.</p>
        ) : (
          shown.map((t) => <TxnCard key={t.id} txn={t} onChange={reload} />)
        )}
      </div>

      {confirmDelete && (
        <OptionsMenu
          onClose={() => setConfirmDelete(false)}
          options={[
            {
              label: "Delete statement and its links",
              danger: true,
              onClick: async () => {
                await api(`/api/reconcile/${id}`, { method: "DELETE" });
                toast("Statement deleted. Your orders were not changed.");
                router.replace("/reconcile");
              },
            },
          ]}
        />
      )}
    </div>
  );
}
