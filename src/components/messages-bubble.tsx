"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { useApi } from "@/lib/client";
import type { Conversation } from "@/lib/types";
import { useApp } from "./app-context";
import { Avatar } from "./ui";

/** Desktop "Messages" pill in the bottom-right corner: unread count and the latest chats' avatars. */
export function MessagesBubble() {
  const { unread } = useApp();
  // Reloads whenever the unread count changes, so the avatars follow new messages.
  const { data } = useApi<{ conversations: Conversation[] }>(`/api/conversations?u=${unread.messages}`);
  const recent = data?.conversations.slice(0, 3) ?? [];

  return (
    <Link
      href="/direct/inbox"
      className="fixed bottom-6 right-6 z-40 hidden items-center gap-3 rounded-full border border-border bg-elevated py-3 pl-4 pr-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-hover md:flex"
    >
      <span className="relative">
        <Send size={24} />
        {unread.messages > 0 && (
          <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-elevated bg-[#ff3040] px-1 text-[11px] font-bold leading-none text-white">
            {unread.messages > 9 ? "9+" : unread.messages}
          </span>
        )}
      </span>
      <span className="font-semibold">Messages</span>
      {recent.length > 0 && (
        <span className="flex">
          {recent.map((c, i) => (
            <Avatar key={c.id} src={c.other.avatar} size={24} className={`ring-2 ring-elevated ${i > 0 ? "-ml-2" : ""}`} />
          ))}
        </span>
      )}
    </Link>
  );
}
