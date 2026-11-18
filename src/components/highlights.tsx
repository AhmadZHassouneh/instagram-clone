"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { api, useApi } from "@/lib/client";
import type { Highlight, Media, Story } from "@/lib/types";
import { useApp } from "./app-context";
import { Modal, Spinner } from "./ui";

function Cover({ media }: { media: Media }) {
  return media.kind === "video" ? (
    <video src={`${media.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt="" className="h-full w-full object-cover" draggable={false} />
  );
}

function Circle({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="flex w-[64px] shrink-0 flex-col items-center gap-1.5 md:w-[87px]">
      <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full border border-border bg-bg p-[3px] md:h-[87px] md:w-[87px]">
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-secondary">{children}</span>
      </span>
      <span className="w-full truncate text-center text-xs font-semibold">{label}</span>
    </span>
  );
}

/** The row of story highlights under a profile's bio. */
export function HighlightsRow({ username, isMe }: { username: string; isMe: boolean }) {
  const { data, reload } = useApi<{ highlights: Highlight[] }>(`/api/users/${username}/highlights`);
  const [creating, setCreating] = useState(false);
  const highlights = data?.highlights ?? [];
  if (!isMe && highlights.length === 0) return null;

  return (
    <div className="no-scrollbar mb-6 flex gap-4 overflow-x-auto px-4 md:mb-11 md:gap-10 md:px-11">
      {highlights.map((h) => (
        <Link key={h.id} href={`/stories/highlights/${h.id}`}>
          <Circle label={h.title}>
            <Cover media={h.cover} />
          </Circle>
        </Link>
      ))}
      {isMe && (
        <button onClick={() => setCreating(true)} aria-label="New highlight">
          <Circle label="New">
            <Plus size={44} strokeWidth={1} className="text-muted" />
          </Circle>
        </button>
      )}
      {creating && (
        <NewHighlightModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function NewHighlightModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useApp();
  const { data } = useApi<{ stories: Story[] }>("/api/stories/archive");
  const [step, setStep] = useState<"title" | "stories">("title");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const create = async () => {
    setBusy(true);
    try {
      await api("/api/highlights", { body: { title, storyIds: picked } });
      toast("Highlight added to your profile.");
      onCreated();
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} showClose={false} className="flex max-h-[80vh] w-[400px] max-w-full flex-col">
      <div className="relative flex h-[43px] shrink-0 items-center justify-center border-b border-border font-semibold">
        {step === "title" ? "New highlight" : "Stories"}
        <button className="absolute right-2 p-2" onClick={onClose} aria-label="Close">
          <X size={24} />
        </button>
      </div>

      {step === "title" ? (
        <form
          className="p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setStep("stories");
          }}
        >
          <input
            autoFocus
            value={title}
            maxLength={15}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Highlight name"
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none"
          />
          <button type="submit" disabled={!title.trim()} className="mt-4 w-full border-t border-border pt-3 font-semibold text-link disabled:opacity-40">
            Next
          </button>
        </form>
      ) : (
        <>
          <div className="min-h-[200px] flex-1 overflow-y-auto">
            {!data ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : data.stories.length === 0 ? (
              <p className="px-6 py-10 text-center text-muted">Share a story first, then you can add it to a highlight.</p>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {data.stories.map((s) => (
                  <button key={s.id} onClick={() => toggle(s.id)} className="relative aspect-[9/16] overflow-hidden bg-black">
                    <Cover media={s} />
                    <span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1 text-[11px] font-semibold text-black">
                      {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                    <span
                      className={`absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${
                        picked.includes(s.id) ? "bg-link" : "bg-black/30"
                      }`}
                    >
                      {picked.includes(s.id) && <Check size={14} strokeWidth={3} className="text-white" />}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={create}
            disabled={busy || picked.length === 0}
            className="min-h-12 shrink-0 border-t border-border font-semibold text-link disabled:opacity-40"
          >
            {busy ? "Adding…" : "Done"}
          </button>
        </>
      )}
    </Modal>
  );
}
