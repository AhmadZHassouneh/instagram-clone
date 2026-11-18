"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Heart, Play, Volume2, VolumeX } from "lucide-react";
import type { Media } from "@/lib/types";

// One shared mute setting for every video, like Instagram.
let muted = true;
const listeners = new Set<() => void>();
export function useMuted() {
  const value = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => muted,
    () => true,
  );
  const toggle = () => {
    muted = !muted;
    listeners.forEach((l) => l());
  };
  return [value, toggle] as const;
}

/** Plays when at least half visible, pauses otherwise. */
export function AutoVideo({
  src,
  className = "",
  active = true,
  onTogglePause,
  paused,
  loop = true,
}: {
  src: string;
  className?: string;
  active?: boolean;
  paused?: boolean;
  onTogglePause?: () => void;
  loop?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [isMuted] = useMuted();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible && active && !paused) el.play().catch(() => {});
    else el.pause();
  }, [visible, active, paused]);

  return (
    <video
      ref={ref}
      src={src}
      muted={isMuted}
      loop={loop}
      playsInline
      preload="metadata"
      className={className}
      onClick={onTogglePause}
    />
  );
}

export function MuteButton({ className = "" }: { className?: string }) {
  const [isMuted, toggle] = useMuted();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-full bg-[#262626]/80 text-white ${className}`}
      aria-label={isMuted ? "Unmute" : "Mute"}
    >
      {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
    </button>
  );
}

/**
 * Swipeable media carousel with Instagram's arrows, dots and double-tap-to-like.
 * fit="feed" sizes to the first item's aspect ratio (clamped like Instagram, 4:5 to 1.91:1);
 * fit="contain" fills its parent and letterboxes.
 */
export function MediaCarousel({
  media,
  onDoubleTap,
  fit = "feed",
  dotsInside = false,
  aspect,
}: {
  media: Media[];
  onDoubleTap?: () => void;
  fit?: "feed" | "contain";
  dotsInside?: boolean;
  /** Fixed aspect ratio (e.g. "9/16" for reels on phones) instead of the first image's. */
  aspect?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [ratio, setRatio] = useState(1);
  const [hearts, setHearts] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const lastTap = useRef(0);

  const go = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const onTap = () => {
    const t = Date.now();
    if (t - lastTap.current < 300) {
      onDoubleTap?.();
      const id = t;
      setHearts((h) => [...h, id]);
      setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1000);
      lastTap.current = 0;
    } else {
      lastTap.current = t;
      if (media[index]?.kind === "video") setPaused((p) => !p);
    }
  };

  const setFromSize = (w: number, h: number, i: number) => {
    if (i === 0 && w && h) setRatio(Math.min(1.91, Math.max(0.8, w / h)));
  };

  const many = media.length > 1;
  const box =
    fit === "feed" ? { aspectRatio: aspect ?? String(ratio) } : { width: "100%", height: "100%" };

  return (
    <div className="relative select-none bg-black" style={box}>
      <div
        ref={scroller}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        onClick={onTap}
      >
        {media.map((m, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center">
            {m.kind === "video" ? (
              <>
                <AutoVideo
                  src={m.url}
                  active={i === index}
                  paused={paused}
                  className={`h-full w-full ${fit === "feed" ? "object-cover" : "object-contain"}`}
                />
                {paused && i === index && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/50 p-5">
                      <Play size={36} className="fill-white text-white" />
                    </span>
                  </span>
                )}
                <MuteButton className="absolute bottom-3 right-3" />
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.url}
                alt=""
                draggable={false}
                className={`h-full w-full ${fit === "feed" ? "object-cover" : "object-contain"}`}
                onLoad={(e) => setFromSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight, i)}
              />
            )}
          </div>
        ))}
      </div>

      {many && index > 0 && (
        <button
          onClick={() => go(index - 1)}
          className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black shadow hover:bg-white"
          aria-label="Previous"
        >
          <ChevronLeft size={16} strokeWidth={3} />
        </button>
      )}
      {many && index < media.length - 1 && (
        <button
          onClick={() => go(index + 1)}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black shadow hover:bg-white"
          aria-label="Next"
        >
          <ChevronRight size={16} strokeWidth={3} />
        </button>
      )}
      {many && (
        <div
          className={`pointer-events-none absolute left-0 right-0 flex justify-center gap-1 ${
            dotsInside ? "bottom-4" : "-bottom-[18px]"
          }`}
        >
          {media.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === index ? "bg-link" : dotsInside ? "bg-white/50" : "bg-muted/40"
              }`}
            />
          ))}
        </div>
      )}
      {many && (
        <span className="absolute right-3 top-3 rounded-full bg-[#121212]/70 px-2 py-0.5 text-xs font-semibold text-white">
          {index + 1}/{media.length}
        </span>
      )}

      {hearts.map((id) => (
        <span key={id} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Heart size={110} strokeWidth={0} className="animate-like-pop fill-white drop-shadow-lg" />
        </span>
      ))}
    </div>
  );
}
