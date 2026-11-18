"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Bookmark, Clapperboard, Heart, MessageCircle, MoreHorizontal, Play, Send } from "lucide-react";
import { compact, useApi } from "@/lib/client";
import type { Post } from "@/lib/types";
import { useApp } from "@/components/app-context";
import { AutoVideo, MuteButton } from "@/components/media";
import { HeartIcon, usePostToggles } from "@/components/post-actions";
import { PostMenu } from "@/components/post-card";
import { Caption, FollowButton } from "@/components/social";
import { Avatar, PrimaryButton, Spinner } from "@/components/ui";

function Reel({ reel: initial, onRemove }: { reel: Post; onRemove: () => void }) {
  const { me, openPost, openShare } = useApp();
  const [reel, setReel] = useState(initial);
  const { like, save } = usePostToggles(reel, setReel);
  const [paused, setPaused] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const [menu, setMenu] = useState(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onTap = () => {
    const t = Date.now();
    if (t - lastTap.current < 300) {
      clearTimeout(tapTimer.current);
      like(true);
      setHearts((h) => [...h, t]);
      setTimeout(() => setHearts((h) => h.filter((x) => x !== t)), 1000);
      lastTap.current = 0;
    } else {
      lastTap.current = t;
      tapTimer.current = setTimeout(() => setPaused((p) => !p), 280);
    }
  };

  const action = (icon: React.ReactNode, label: string | number | null, onClick: () => void, aria: string) => (
    <button onClick={onClick} className="flex flex-col items-center gap-1 text-xs font-medium hover:opacity-60" aria-label={aria}>
      {icon}
      {label !== null && <span>{label}</span>}
    </button>
  );

  return (
    <section className="flex h-[calc(100dvh-var(--nav-h))] snap-start snap-always items-center justify-center md:h-screen md:py-4">
      <div className="relative flex h-full items-end gap-4">
        <div className="relative h-full w-screen overflow-hidden bg-black md:aspect-[9/16] md:w-auto md:rounded-md">
          <div className="absolute inset-0" onClick={onTap}>
            <AutoVideo src={reel.media[0]?.url} paused={paused} className="h-full w-full object-cover" />
          </div>
          {paused && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/40 p-5">
                <Play size={40} className="fill-white text-white" />
              </span>
            </span>
          )}
          {hearts.map((id) => (
            <span key={id} className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart size={110} strokeWidth={0} className="animate-like-pop fill-white drop-shadow-lg" />
            </span>
          ))}
          <MuteButton className="absolute right-4 top-4" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pr-16 text-white md:pr-4">
            <div className="pointer-events-auto flex items-center gap-2.5">
              <Link href={`/${reel.user.username}`}>
                <Avatar src={reel.user.avatar} size={32} />
              </Link>
              <Link href={`/${reel.user.username}`} className="font-semibold">
                {reel.user.username}
              </Link>
              {reel.user.id !== me.id && !reel.user.isFollowing && (
                <span className="[&_button]:rounded-lg [&_button]:border [&_button]:border-white/40 [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-1">
                  <FollowButton
                    username={reel.user.username}
                    isFollowing={false}
                    onChange={(f) => setReel({ ...reel, user: { ...reel.user, isFollowing: f } })}
                  />
                </span>
              )}
            </div>
            <div className="pointer-events-auto mt-2 line-clamp-2 [&_a]:text-white">
              <Caption user={reel.user} text={reel.caption} />
            </div>
          </div>

          {/* Phone: actions over the video */}
          <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5 text-white md:hidden">
            {action(<HeartIcon filled={reel.liked} size={28} />, compact(reel.likeCount), () => like(), "Like")}
            {action(<MessageCircle size={28} className="-scale-x-100" />, compact(reel.commentCount), () => openPost(reel, (p) => (p ? setReel(p) : onRemove())), "Comment")}
            {action(<Send size={28} />, null, () => openShare(reel), "Share")}
            {action(<Bookmark size={28} className={reel.saved ? "fill-current" : ""} />, null, save, "Save")}
            {action(<MoreHorizontal size={28} />, null, () => setMenu(true), "More")}
          </div>
        </div>

        {/* Desktop: actions beside the video */}
        <div className="hidden flex-col items-center gap-6 pb-2 md:flex">
          {action(<HeartIcon filled={reel.liked} size={26} />, compact(reel.likeCount), () => like(), "Like")}
          {action(<MessageCircle size={26} className="-scale-x-100" />, compact(reel.commentCount), () => openPost(reel, (p) => (p ? setReel(p) : onRemove())), "Comment")}
          {action(<Send size={26} />, null, () => openShare(reel), "Share")}
          {action(<Bookmark size={26} className={reel.saved ? "fill-current" : ""} />, null, save, "Save")}
          {action(<MoreHorizontal size={26} />, null, () => setMenu(true), "More")}
          <Link href={`/${reel.user.username}`} className="overflow-hidden rounded-md border border-fg/20">
            <Avatar src={reel.user.avatar} size={26} className="rounded-md" />
          </Link>
        </div>
      </div>
      {menu && (
        <PostMenu
          post={reel}
          onClose={() => setMenu(false)}
          onDeleted={onRemove}
          onUnfollow={() => setReel({ ...reel, user: { ...reel.user, isFollowing: false } })}
        />
      )}
    </section>
  );
}

export default function ReelsPage() {
  const { data, setData } = useApi<{ posts: Post[] }>("/api/reels");
  const { setCreateOpen } = useApp();

  if (!data)
    return (
      <div className="flex h-screen items-center justify-center bg-black md:bg-bg">
        <Spinner />
      </div>
    );

  if (data.posts.length === 0)
    return (
      <div className="flex h-[calc(100dvh-var(--nav-h))] flex-col items-center justify-center gap-4 text-center md:h-screen">
        <Clapperboard size={64} strokeWidth={1} />
        <p className="text-xl font-semibold">No reels yet</p>
        <p className="text-muted">Share a video to create the first reel.</p>
        <PrimaryButton onClick={() => setCreateOpen(true)}>Create reel</PrimaryButton>
      </div>
    );

  return (
    <div className="no-scrollbar h-[calc(100dvh-var(--nav-h))] snap-y snap-mandatory overflow-y-scroll bg-black md:h-screen md:bg-bg">
      {data.posts.map((r) => (
        <Reel key={r.id} reel={r} onRemove={() => setData({ posts: data.posts.filter((x) => x.id !== r.id) })} />
      ))}
    </div>
  );
}
