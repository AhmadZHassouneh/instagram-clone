"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { X } from "lucide-react";
import { api, useApi } from "@/lib/client";
import type { FollowUser, UserLite } from "@/lib/types";
import { useApp } from "./app-context";
import { Avatar, Modal, PrimaryButton, SecondaryButton, Spinner, UserName } from "./ui";

/** Turns @mentions and #hashtags into links, like Instagram captions. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/([@#][\w.]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") && p.length > 1 ? (
          <Link key={i} href={`/${p.slice(1).replace(/\.$/, "")}`} className="text-link-text">
            {p}
          </Link>
        ) : p.startsWith("#") && p.length > 1 ? (
          <Link key={i} href="/explore" className="text-link-text">
            {p}
          </Link>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function Caption({ user, text, clamp = true }: { user: UserLite; text: string; clamp?: boolean }) {
  const [expanded, setExpanded] = useState(!clamp);
  if (!text) return null;
  const long = text.length > 125 || text.split("\n").length > 2;
  const shown = expanded || !long ? text : text.split("\n").slice(0, 2).join("\n").slice(0, 125);
  return (
    <div className="whitespace-pre-line break-words">
      <UserName user={user} className="mr-1" />
      <RichText text={shown} />
      {!expanded && long && (
        <>
          ...{" "}
          <button className="text-muted" onClick={() => setExpanded(true)}>
            more
          </button>
        </>
      )}
    </div>
  );
}

export function FollowButton({
  username,
  isFollowing,
  onChange,
  variant = "button",
  followsYou = false,
}: {
  username: string;
  isFollowing: boolean;
  onChange?: (following: boolean) => void;
  variant?: "button" | "link";
  followsYou?: boolean;
}) {
  const [following, setFollowing] = useState(isFollowing);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { toast, refreshUnread } = useApp();

  const set = async (value: boolean) => {
    setBusy(true);
    setFollowing(value);
    try {
      await api(`/api/users/${username}/follow`, { method: value ? "POST" : "DELETE" });
      onChange?.(value);
      refreshUnread();
    } catch (e) {
      setFollowing(!value);
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const click = () => (following ? setConfirm(true) : set(true));
  const label = following ? "Following" : followsYou ? "Follow Back" : "Follow";

  return (
    <>
      {variant === "link" ? (
        <button
          onClick={click}
          disabled={busy}
          className={`text-xs font-semibold ${following ? "text-fg hover:text-muted" : "text-link hover:text-link-text"}`}
        >
          {label}
        </button>
      ) : following ? (
        <SecondaryButton onClick={click} disabled={busy}>
          {label}
        </SecondaryButton>
      ) : (
        <PrimaryButton onClick={click} disabled={busy}>
          {label}
        </PrimaryButton>
      )}
      {confirm && (
        <Modal onClose={() => setConfirm(false)} showClose={false} className="w-[400px] max-w-full">
          <div className="flex flex-col items-center px-8 pb-6 pt-8 text-center">
            <p className="text-sm">Unfollow @{username}?</p>
          </div>
          <button
            className="min-h-12 w-full border-t border-border text-sm font-bold text-danger"
            onClick={() => {
              setConfirm(false);
              set(false);
            }}
          >
            Unfollow
          </button>
          <button className="min-h-12 w-full border-t border-border text-sm" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </Modal>
      )}
    </>
  );
}

export function UserRow({
  user,
  subtitle,
  action,
  onNavigate,
}: {
  user: UserLite;
  subtitle?: string;
  action?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <Link href={`/${user.username}`} onClick={onNavigate}>
        <Avatar src={user.avatar} size={44} />
      </Link>
      <div className="min-w-0 flex-1 leading-[18px]" onClick={onNavigate}>
        <UserName user={user} />
        <div className="truncate text-muted">{subtitle ?? user.name}</div>
      </div>
      {action}
    </div>
  );
}

/** Followers / following / likes list in a modal. */
export function UserListModal({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  const { data } = useApi<{ users: FollowUser[] }>(url);
  const [q, setQ] = useState("");
  const users = data?.users.filter(
    (u) => !q || u.username.toLowerCase().includes(q.toLowerCase()) || u.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Modal onClose={onClose} showClose={false} className="flex h-[min(400px,80vh)] w-[400px] max-w-full flex-col">
      <div className="relative flex h-[43px] shrink-0 items-center justify-center border-b border-border font-semibold">
        {title}
        <button className="absolute right-2 p-2" onClick={onClose} aria-label="Close">
          <X size={24} />
        </button>
      </div>
      {title !== "Likes" && (
        <div className="px-4 pt-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="w-full rounded-lg bg-secondary px-4 py-[7px] outline-none placeholder:text-muted"
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-2">
        {!users ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-muted">No users found.</p>
        ) : (
          users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              onNavigate={onClose}
              action={!u.isMe && <FollowButton username={u.username} isFollowing={u.isFollowing} />}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
