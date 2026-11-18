"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Image as ImageIcon, Info, Mic, MoreHorizontal, Phone, Search, Smile, SquarePen, Send, Sticker, Video, X } from "lucide-react";
import { api, timeAgo, useApi, useIsPhone } from "@/lib/client";
import type { Conversation, FollowUser, Message, Post, UserLite } from "@/lib/types";

/** One-line inbox preview for any message kind. */
function previewText(m: NonNullable<Conversation["lastMessage"]>) {
  switch (m.kind) {
    case "post":
      return "Sent a post";
    case "voice":
      return "Voice message";
    case "invoice":
      return "Sent an invoice";
    case "receipt":
      return "Sent a receipt";
    default:
      return m.text;
  }
}
import { useApp } from "./app-context";
import { InvoiceCardView, VoiceBubble } from "./invoice-card";
import { Avatar, Modal, OptionsMenu, PrimaryButton, Spinner, Verified } from "./ui";

function NewMessageModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { me } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FollowUser[] | null>(null);
  const [picked, setPicked] = useState<FollowUser | null>(null);
  const following = useApi<{ users: FollowUser[] }>(`/api/users/${me.username}/following`);

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(
      () => api<{ users: FollowUser[] }>(`/api/search?q=${encodeURIComponent(q)}`).then((d) => setResults(d.users.filter((u) => !u.isMe))),
      200,
    );
    return () => clearTimeout(t);
  }, [q]);

  const start = async () => {
    if (!picked) return;
    const { id } = await api<{ id: number }>("/api/conversations", { body: { username: picked.username } });
    onClose();
    router.push(`/direct/t/${id}`);
  };

  const searchResults = q.trim() ? results : null;
  const list = searchResults ?? following.data?.users;
  return (
    <Modal onClose={onClose} showClose={false} className="flex h-[min(480px,85vh)] w-[548px] max-w-full flex-col">
      <div className="relative flex h-[43px] shrink-0 items-center justify-center border-b border-border font-semibold">
        New message
        <button className="absolute right-2 p-2" onClick={onClose} aria-label="Close">
          <X size={24} />
        </button>
      </div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="font-semibold">To:</span>
        {picked && (
          <button onClick={() => setPicked(null)} className="flex items-center gap-1 rounded-full bg-[#e0f1ff] px-3 py-1 text-sm font-semibold text-link">
            {picked.username} <X size={14} />
          </button>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." autoFocus className="flex-1 bg-transparent py-1 outline-none placeholder:text-muted" />
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
          list.map((u) => (
            <button key={u.id} onClick={() => setPicked(u)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover">
              <Avatar src={u.avatar} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate">{u.name || u.username}</div>
                <div className="truncate text-muted">{u.username}</div>
              </div>
              <span className={`h-6 w-6 rounded-full border-2 ${picked?.id === u.id ? "border-[6px] border-link" : "border-fg/60"}`} />
            </button>
          ))
        )}
      </div>
      <div className="p-4">
        <PrimaryButton className="w-full" disabled={!picked} onClick={start}>
          Chat
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function ConversationList({ selectedId }: { selectedId: number | null }) {
  const { me } = useApp();
  const { data, reload } = useApi<{ conversations: Conversation[] }>("/api/conversations");
  const [composing, setComposing] = useState(false);
  const [q, setQ] = useState("");
  const phone = useIsPhone();
  const needle = q.trim().toLowerCase();
  const shown = data?.conversations.filter(
    (c) => !needle || c.other.username.toLowerCase().includes(needle) || (c.other.name ?? "").toLowerCase().includes(needle),
  );

  useEffect(() => {
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);
  // Refresh right away when the selected thread changes so its unread state clears.
  useEffect(() => {
    if (selectedId) setTimeout(reload, 400);
  }, [selectedId, reload]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 pb-3 pt-9 max-md:px-4 max-md:pt-3">
        {/* Phones: big centered username, like the Instagram app. */}
        <span className="flex items-center gap-1 text-xl font-bold max-md:flex-1 max-md:justify-center max-md:pl-7 max-md:text-[22px]">
          {me.username}
          {me.verified && <Verified size={14} />}
          <ChevronDown size={18} />
        </span>
        <button onClick={() => setComposing(true)} aria-label="New message">
          <SquarePen size={26} />
        </button>
      </div>
      <label className="mx-4 mb-2 flex h-11 items-center gap-3 rounded-full bg-field px-4 text-muted max-md:mx-3 max-md:h-12">
        <Search size={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted"
        />
      </label>
      {/* Notes row: your note, then the people you chat with (display only). */}
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-6 pb-1 pt-2 max-md:px-3">
        <div className="flex w-[88px] shrink-0 flex-col items-center">
          <span className="relative z-10 mb-[-12px] line-clamp-2 max-w-[92px] rounded-2xl bg-field px-3 py-1.5 text-center text-xs leading-4 text-muted max-md:text-[13px]">
            Start your first note...
          </span>
          <Avatar src={me.avatar} size={phone ? 80 : 74} />
          <span className="mt-1.5 text-xs text-muted max-md:text-[13px]">Your note</span>
        </div>
        {data?.conversations.slice(0, 12).map((c) => (
          <Link key={c.id} href={`/direct/t/${c.id}`} className="flex w-[88px] shrink-0 flex-col items-center pt-[22px]">
            <Avatar src={c.other.avatar} size={phone ? 80 : 74} />
            <span className="mt-1.5 w-full truncate text-center text-xs max-md:text-[13px]">{c.other.name || c.other.username}</span>
          </Link>
        ))}
      </div>
      <div className="flex items-center justify-between px-6 pb-2.5 pt-3 max-md:px-4 max-md:pt-4">
        <span className="text-base font-bold max-md:text-[17px]">Messages</span>
        <span className="font-semibold text-muted max-md:text-[15px]">Requests</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!shown ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : shown.length === 0 ? (
          <p className="px-6 py-4 text-muted">No messages found.</p>
        ) : (
          shown.map((c) => {
            const last = c.lastMessage;
            const preview = last
              ? `${last.senderId === me.id ? "You: " : ""}${previewText(last)}`
              : "";
            return (
              <Link
                key={c.id}
                href={`/direct/t/${c.id}`}
                className={`flex items-center gap-3 px-6 py-2 hover:bg-hover max-md:px-4 max-md:py-2.5 ${selectedId === c.id ? "bg-hover" : ""}`}
              >
                <Avatar src={c.other.avatar} size={56} />
                <div className="min-w-0 flex-1 max-md:leading-[22px]">
                  <div className={`truncate text-[15px] max-md:text-base ${c.unread ? "font-bold" : ""}`}>{c.other.name || c.other.username}</div>
                  <div className={`flex text-[13px] max-md:text-[15px] ${c.unread ? "font-bold text-fg" : "text-muted"}`}>
                    <span className="truncate">{preview}</span>
                    {last && <span className="shrink-0">&nbsp;· {timeAgo(last.createdAt)}</span>}
                  </div>
                </div>
                {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#5865f2] max-md:h-2.5 max-md:w-2.5" />}
              </Link>
            );
          })
        )}
      </div>
      {composing && <NewMessageModal onClose={() => setComposing(false)} />}
    </div>
  );
}

function SharedPostBubble({ post, mine }: { post: NonNullable<Message["post"]>; mine: boolean }) {
  const { openPost } = useApp();
  return (
    <button
      onClick={() => api<{ post: Post }>(`/api/posts/${post.id}`).then((d) => openPost(d.post))}
      className={`w-[236px] overflow-hidden rounded-2xl text-left ${mine ? "bg-bubble-mine text-white" : "bg-bubble-them"}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar src={post.user.avatar} size={24} />
        <span className="font-semibold">{post.user.username}</span>
      </div>
      <div className="aspect-square bg-black">
        {post.thumb.kind === "video" ? (
          <video src={post.thumb.url} muted preload="metadata" className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumb.url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      {post.caption && (
        <div className="line-clamp-2 px-3 py-2 text-[13px]">
          <span className="font-semibold">{post.user.username}</span> {post.caption}
        </div>
      )}
    </button>
  );
}

const QUICK_EMOJI = ["😂", "😍", "🥰", "😊", "😅", "😎", "🤔", "😢", "👍", "👌", "🙏", "👏", "💪", "🔥", "✨", "🎉", "❤️", "💕", "🤍", "✅", "📦", "👕", "☕", "🛍️"];

/** Messages are shown in time order; ids break ties. */
const byTime = (a: Message, b: Message) => a.createdAt - b.createdAt || a.id - b.id;

function Thread({ id }: { id: number }) {
  const { me, refreshUnread, toast } = useApp();
  const [other, setOther] = useState<UserLite | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [otherLastReadId, setOtherLastReadId] = useState(0);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Phones: press and hold a message for its menu (iOS Safari doesn't fire contextmenu on touch).
  const holdToOpenMenu = (messageId: number) => {
    const cancel = () => clearTimeout(pressTimer.current);
    return {
      onTouchStart: () => {
        cancel();
        pressTimer.current = setTimeout(() => setMenuFor(messageId), 500);
      },
      onTouchEnd: cancel,
      onTouchMove: cancel,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        setMenuFor(messageId);
      },
    };
  };
  const lastId = useRef(0);

  useEffect(() => {
    // <Thread> is keyed by conversation id, so state starts fresh for each thread.
    let stop = false;
    const poll = async () => {
      try {
        const d = await api<{ other: UserLite; messages: Message[]; ids: number[]; otherLastReadId: number }>(
          `/api/conversations/${id}/messages?after=${lastId.current}`,
        );
        if (stop) return;
        setOther(d.other);
        setOtherLastReadId(d.otherLastReadId);
        // Drop messages that were unsent; anything newer than the server's list was just sent and is kept.
        const present = new Set(d.ids);
        const newest = d.ids.length ? Math.max(...d.ids) : 0;
        setMessages((m) => (m && m.some((x) => x.id <= newest && !present.has(x.id)) ? m.filter((x) => x.id > newest || present.has(x.id)) : m));
        if (d.messages.length) {
          lastId.current = Math.max(lastId.current, ...d.messages.map((x) => x.id));
          setMessages((m) => {
            const known = new Set((m ?? []).map((x) => x.id));
            return [...(m ?? []), ...d.messages.filter((x) => !known.has(x.id))].sort(byTime);
          });
          refreshUnread();
        } else setMessages((m) => m ?? []);
      } catch {
        if (!stop) setError(true);
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id, refreshUnread]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  const send = async (body: string) => {
    const t = body.trim();
    if (!t) return;
    setText("");
    try {
      const { message } = await api<{ message: Message }>(`/api/conversations/${id}/messages`, { body: { text: t } });
      lastId.current = Math.max(lastId.current, message.id);
      setMessages((m) => (m?.some((x) => x.id === message.id) ? m : [...(m ?? []), message].sort(byTime)));
    } catch (e) {
      toast((e as Error).message);
      setText(t);
    }
  };

  const unsend = async (messageId: number) => {
    setMenuFor(null);
    try {
      await api(`/api/messages/${messageId}`, { method: "DELETE" });
      setMessages((m) => m?.filter((x) => x.id !== messageId) ?? m);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  if (error)
    return (
      <div className="flex h-full items-center justify-center text-muted">
        This conversation isn&apos;t available.
      </div>
    );
  if (!other || !messages)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[75px] shrink-0 items-center gap-3 border-b border-separator px-4 max-md:h-14">
        <Link href="/direct/inbox" className="md:hidden" aria-label="Back">
          <ChevronLeft size={28} />
        </Link>
        <Link href={`/${other.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar src={other.avatar} size={44} />
          <div className="min-w-0">
            <div className="flex items-center truncate text-base font-semibold">
              {other.name || other.username}
              {other.verified && <Verified />}
            </div>
            <div className="truncate text-xs text-muted">{other.username}</div>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <button onClick={() => toast("Calls aren't available yet.")} aria-label="Audio call">
            <Phone size={24} />
          </button>
          <button onClick={() => toast("Video calls aren't available yet.")} aria-label="Video call">
            <Video size={26} />
          </button>
          <Link href={`/${other.username}`} aria-label="Conversation information">
            <Info size={24} />
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-8 flex flex-col items-center pt-4 text-center">
          <Avatar src={other.avatar} size={96} />
          <div className="mt-3 flex items-center text-xl font-semibold">
            {other.name || other.username}
            {other.verified && <Verified size={14} />}
          </div>
          <div className="text-muted">{other.username} · Instagram</div>
          <Link href={`/${other.username}`} className="mt-4 rounded-lg bg-secondary px-4 py-[7px] font-semibold hover:bg-secondary-hover">
            View profile
          </Link>
        </div>

        {messages.map((m, i) => {
          const mine = m.senderId === me.id;
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const showTime = !prev || m.createdAt - prev.createdAt > 60 * 60 * 1000;
          const lastOfGroup = !next || next.senderId !== m.senderId || next.createdAt - m.createdAt > 60 * 60 * 1000;
          const bigEmoji = /^\p{Extended_Pictographic}{1,3}$/u.test(m.text);
          const canUnsend = mine && m.kind !== "invoice" && m.kind !== "receipt" && m.kind !== "welcome";
          return (
            <div key={m.id}>
              {showTime && (
                <div className="my-4 text-center text-xs text-muted">
                  {new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              )}
              <div
                className={`group mb-0.5 flex items-end gap-2 max-md:select-none ${mine ? "justify-end" : ""} ${lastOfGroup ? "mb-2" : ""}`}
                {...(canUnsend ? holdToOpenMenu(m.id) : {})}
              >
                {!mine && <span className="w-7 shrink-0">{lastOfGroup && <Avatar src={other.avatar} size={28} />}</span>}
                {canUnsend && (
                  <button
                    className="self-center p-1 text-muted opacity-0 hover:text-fg group-hover:opacity-100 max-md:hidden"
                    onClick={() => setMenuFor(m.id)}
                    aria-label="Message options"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                )}
                {m.invoice ? (
                  <InvoiceCardView invoice={m.invoice} />
                ) : m.kind === "voice" ? (
                  <VoiceBubble seconds={m.voiceSeconds ?? 0} mine={mine} />
                ) : m.post ? (
                  <SharedPostBubble post={m.post} mine={mine} />
                ) : bigEmoji ? (
                  <span className="text-[40px] leading-[48px]">{m.text}</span>
                ) : (
                  <span
                    dir="auto"
                    title={new Date(m.createdAt).toLocaleString()}
                    className={`max-w-[75%] md:max-w-[60%] whitespace-pre-wrap break-words rounded-[18px] px-3 py-[7px] text-[15px] leading-5 ${
                      mine ? "bg-bubble-mine text-white" : "bg-bubble-them"
                    }`}
                  >
                    {m.text}
                  </span>
                )}
              </div>
              {mine && !next && (
                <div className="-mt-1 mb-2 text-right text-xs text-muted">
                  {otherLastReadId >= m.id ? "Seen" : "Sent"}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {menuFor !== null && (
        <OptionsMenu onClose={() => setMenuFor(null)} options={[{ label: "Unsend", danger: true, onClick: () => unsend(menuFor) }]} />
      )}

      <form
        className="relative m-3 mb-[calc(12px+env(safe-area-inset-bottom))] flex min-h-[44px] items-center gap-3 rounded-full border border-border px-4 py-1 md:m-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        {emojiOpen && (
          <div className="absolute bottom-[52px] left-0 grid grid-cols-8 gap-1 rounded-xl bg-elevated p-2 shadow-lg">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                className="rounded p-1 text-2xl hover:bg-hover"
                onClick={() => {
                  setText((t) => t + e);
                  setEmojiOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setEmojiOpen((o) => !o)} aria-label="Choose an emoji">
          <Smile size={24} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          dir="auto"
          className="min-w-0 flex-1 bg-transparent py-1.5 outline-none placeholder:text-muted"
          maxLength={1000}
          autoFocus
        />
        {text.trim() ? (
          <button className="font-semibold text-link hover:text-link-text">Send</button>
        ) : (
          <>
            <button type="button" onClick={() => toast("Voice messages aren't available yet.")} aria-label="Voice message">
              <Mic size={24} />
            </button>
            <button type="button" onClick={() => toast("Sending photos isn't available yet.")} aria-label="Add photo or video">
              <ImageIcon size={24} />
            </button>
            <button type="button" onClick={() => send("❤️")} aria-label="Send a heart">
              <Sticker size={24} />
            </button>
          </>
        )}
      </form>
    </div>
  );
}

/** Instagram Direct: conversation list on the left, open thread on the right (one at a time on phones). */
export function Inbox({ selectedId }: { selectedId: number | null }) {
  const [composing, setComposing] = useState(false);
  return (
    <div className={`flex md:h-screen ${selectedId ? "h-dvh" : "h-[calc(100dvh-var(--nav-h))]"}`}>
      <div
        className={`w-full shrink-0 border-r border-separator md:w-[108px] min-[62.5rem]:w-[397px] ${selectedId ? "max-md:hidden" : ""}`}
      >
        <div className="h-full md:hidden min-[62.5rem]:flex min-[62.5rem]:flex-col">
          <ConversationList selectedId={selectedId} />
        </div>
        <CompactList selectedId={selectedId} />
      </div>
      <div className={`min-w-0 flex-1 ${selectedId ? "" : "max-md:hidden"}`}>
        {selectedId ? (
          <Thread key={selectedId} id={selectedId} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-fg">
              <Send size={44} strokeWidth={1.3} />
            </span>
            <h2 className="mt-1 text-xl">Your messages</h2>
            <p className="text-muted">Send private photos and messages to a friend or group.</p>
            <PrimaryButton onClick={() => setComposing(true)}>Send message</PrimaryButton>
          </div>
        )}
      </div>
      {composing && <NewMessageModal onClose={() => setComposing(false)} />}
    </div>
  );
}

/** Avatar-only conversation list for medium screens. */
function CompactList({ selectedId }: { selectedId: number | null }) {
  const { data } = useApi<{ conversations: Conversation[] }>("/api/conversations");
  return (
    <div className="hidden h-full flex-col items-center gap-2 overflow-y-auto pt-9 md:flex min-[62.5rem]:hidden">
      {data?.conversations.map((c) => (
        <Link key={c.id} href={`/direct/t/${c.id}`} className={`relative rounded-full p-1 ${selectedId === c.id ? "bg-hover" : ""}`}>
          <Avatar src={c.other.avatar} size={56} />
          {c.unread && <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-bg bg-link" />}
        </Link>
      ))}
    </div>
  );
}
