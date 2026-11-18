"use client";

import { useState } from "react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/client";
import type { Post } from "@/lib/types";
import { useApp } from "./app-context";

/** Optimistic like/save toggles for a post held in the caller's state. */
export function usePostToggles(post: Post, update: (p: Post) => void) {
  const { toast } = useApp();

  const like = async (force?: boolean) => {
    const liked = force ?? !post.liked;
    if (liked === post.liked) return;
    update({ ...post, liked, likeCount: post.likeCount + (liked ? 1 : -1) });
    try {
      await api(`/api/posts/${post.id}/like`, { method: liked ? "POST" : "DELETE" });
    } catch {
      update(post);
      toast("Couldn't update like. Try again.");
    }
  };

  const save = async () => {
    const saved = !post.saved;
    update({ ...post, saved });
    try {
      await api(`/api/posts/${post.id}/save`, { method: saved ? "POST" : "DELETE" });
      toast(saved ? "Saved to your collection." : "Removed from saved.");
    } catch {
      update(post);
    }
  };

  return { like, save };
}

export function HeartIcon({ filled, size = 24, animate = false }: { filled: boolean; size?: number; animate?: boolean }) {
  return (
    <Heart
      size={size}
      strokeWidth={filled ? 0 : 2}
      className={`${filled ? "fill-[#ff3040] text-[#ff3040]" : ""} ${filled && animate ? "animate-heart" : ""}`}
    />
  );
}

export function ActionBar({
  post,
  onLike,
  onSave,
  onComment,
}: {
  post: Post;
  onLike: () => void;
  onSave: () => void;
  onComment?: () => void;
}) {
  const { openShare } = useApp();
  const [animate, setAnimate] = useState(false);
  return (
    <div className="flex items-center py-1.5">
      <button
        className="-ml-2 p-2 hover:opacity-50"
        aria-label={post.liked ? "Unlike" : "Like"}
        onClick={() => {
          setAnimate(true);
          onLike();
        }}
      >
        <HeartIcon filled={post.liked} animate={animate} />
      </button>
      <button className="p-2 hover:opacity-50" aria-label="Comment" onClick={onComment}>
        <MessageCircle size={24} className="-scale-x-100" />
      </button>
      <button className="p-2 hover:opacity-50" aria-label="Share" onClick={() => openShare(post)}>
        <Send size={24} />
      </button>
      <button className="-mr-2 ml-auto p-2 hover:opacity-50" aria-label={post.saved ? "Remove" : "Save"} onClick={onSave}>
        <Bookmark size={24} className={post.saved ? "fill-current" : ""} />
      </button>
    </div>
  );
}
