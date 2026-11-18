"use client";

import { useEffect, useState } from "react";
import { Check, Link2, X } from "lucide-react";
import { api, useApi } from "@/lib/client";
import type { FollowUser } from "@/lib/types";
import { useApp } from "./app-context";
import { Avatar, Modal, PrimaryButton, Spinner } from "./ui";

/** "Share" sheet: send a post to people by direct message. */
export function ShareModal() {
  const { sharePost, closeShare, me, toast } = useApp();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<FollowUser[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<FollowUser[] | null>(null);
  const following = useApi<{ users: FollowUser[] }>(sharePost ? `/api/users/${me.username}/following` : null);

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      api<{ users: FollowUser[] }>(`/api/search?q=${encodeURIComponent(q)}`).then((d) => setResults(d.users.filter((u) => !u.isMe)));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  if (!sharePost) return null;

  const close = () => {
    setSelected([]);
    setQ("");
    setMessage("");
    closeShare();
  };
  const toggle = (u: FollowUser) =>
    setSelected((s) => (s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));

  const send = async () => {
    setSending(true);
    try {
      await api("/api/share", { body: { postId: sharePost.id, userIds: selected.map((u) => u.id), text: message } });
      toast("Sent");
      close();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const searchResults = q.trim() ? results : null;
  const list = searchResults ?? following.data?.users;

  return (
    <Modal onClose={close} showClose={false} className="flex h-[min(520px,85vh)] w-[548px] max-w-full flex-col">
      <div className="relative flex h-[43px] shrink-0 items-center justify-center border-b border-border font-semibold">
        Share
        <button className="absolute right-2 p-2" onClick={close} aria-label="Close">
          <X size={24} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="font-semibold">To:</span>
        {selected.map((u) => (
          <button key={u.id} onClick={() => toggle(u)} className="flex items-center gap-1 rounded-full bg-[#e0f1ff] px-3 py-1 text-sm font-semibold text-link">
            {u.username} <X size={14} />
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search..."
          className="min-w-[120px] flex-1 bg-transparent py-1 outline-none placeholder:text-muted"
          autoFocus
        />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {!searchResults && <div className="px-4 py-1 font-semibold">Suggested</div>}
        {!list ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <p className="px-4 py-3 text-muted">No account found.</p>
        ) : (
          list.map((u) => {
            const on = selected.some((x) => x.id === u.id);
            return (
              <button key={u.id} onClick={() => toggle(u)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover">
                <Avatar src={u.avatar} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{u.name || u.username}</div>
                  <div className="truncate text-muted">{u.username}</div>
                </div>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    on ? "border-link bg-link text-white" : "border-fg/60"
                  }`}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-border p-4">
        {selected.length > 0 && (
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a message..."
            className="mb-3 w-full bg-transparent outline-none placeholder:text-muted"
          />
        )}
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-[7px] text-sm font-semibold hover:bg-secondary-hover"
            onClick={() => {
              navigator.clipboard?.writeText(`${location.origin}/p/${sharePost.id}`);
              toast("Link copied to clipboard.");
            }}
          >
            <Link2 size={16} /> Copy link
          </button>
          <PrimaryButton className="flex-1" disabled={!selected.length || sending} onClick={send}>
            {selected.length > 1 ? "Send separately" : "Send"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
