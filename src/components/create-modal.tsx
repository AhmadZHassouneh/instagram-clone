"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CircleCheck, Images, MapPin } from "lucide-react";
import { api } from "@/lib/client";
import { useApp } from "./app-context";
import { MediaCarousel } from "./media";
import { Avatar, Modal, PrimaryButton, Spinner } from "./ui";

type Picked = { file: File; url: string; kind: "image" | "video" };

/** Instagram's "Create new post" flow: pick files → preview → caption → share. Also posts stories. */
export function CreateModal() {
  const { createOpen, setCreateOpen } = useApp();
  if (!createOpen) return null;
  return <CreateFlow onClose={() => setCreateOpen(false)} />;
}

function CreateFlow({ onClose }: { onClose: () => void }) {
  const { me, toast } = useApp();
  const [mode, setMode] = useState<"post" | "story">("post");
  const [files, setFiles] = useState<Picked[]>([]);
  const [step, setStep] = useState<"pick" | "preview" | "details" | "sharing" | "done">("pick");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const pick = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = [...list]
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .slice(0, mode === "story" ? 1 : 10)
      .map((file) => ({ file, url: URL.createObjectURL(file), kind: file.type.startsWith("video/") ? "video" : "image" }) as Picked);
    if (!picked.length) {
      setError("This file is not supported. Please choose photos or videos.");
      return;
    }
    setError(null);
    setFiles(picked);
    setStep("preview");
  };

  const share = async () => {
    setStep("sharing");
    try {
      const form = new FormData();
      if (mode === "story") {
        form.append("file", files[0].file);
        await api("/api/stories", { body: form });
      } else {
        files.forEach((f) => form.append("files", f.file));
        form.append("caption", caption);
        form.append("location", location);
        await api("/api/posts", { body: form });
      }
      setStep("done");
    } catch (e) {
      toast((e as Error).message);
      setStep(mode === "story" ? "preview" : "details");
    }
  };

  const close = () => {
    if (step === "done") {
      onClose();
      // Lets the feed, stories bar and profile reload so the new post/story shows up.
      window.dispatchEvent(new Event("snapgram:created"));
      return;
    }
    if (files.length && step !== "sharing") setConfirmDiscard(true);
    else if (step !== "sharing") onClose();
  };

  const title =
    step === "pick"
      ? mode === "story" ? "Add to your story" : "Create new post"
      : step === "preview"
        ? mode === "story" ? "Preview story" : "Preview"
        : step === "details"
          ? "Create new post"
          : step === "sharing"
            ? "Sharing"
            : mode === "story" ? "Story shared" : "Post shared";

  const wide = step === "details";

  return (
    <Modal onClose={close} className={`flex flex-col ${wide ? "w-[min(1100px,95vw)]" : "w-[min(740px,95vw)]"}`}>
      <div className="flex h-[43px] shrink-0 items-center border-b border-separator px-3">
        {step === "preview" || step === "details" ? (
          <button onClick={() => (step === "details" ? setStep("preview") : setConfirmDiscard(true))} className="p-1" aria-label="Back">
            <ArrowLeft size={24} />
          </button>
        ) : (
          <span className="w-8" />
        )}
        <h2 className="flex-1 text-center text-base font-semibold">{title}</h2>
        {step === "preview" ? (
          <button
            className="font-semibold text-link hover:text-link-text"
            onClick={() => (mode === "story" ? share() : setStep("details"))}
          >
            {mode === "story" ? "Share" : "Next"}
          </button>
        ) : step === "details" ? (
          <button className="font-semibold text-link hover:text-link-text" onClick={share}>
            Share
          </button>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <div className={`flex ${wide ? "h-[min(75vh,740px)] max-md:h-auto max-md:flex-col" : "h-[min(75vh,740px)]"}`}>
        {step === "pick" && (
          <div
            className={`flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center ${drag ? "bg-hover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files);
            }}
          >
            <Images size={88} strokeWidth={0.8} />
            <p className="text-xl">{error ?? "Drag photos and videos here"}</p>
            <PrimaryButton onClick={() => input.current?.click()}>Select from computer</PrimaryButton>
            <input
              ref={input}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              multiple={mode === "post"}
              hidden
              onChange={(e) => pick(e.target.files)}
            />
            <div className="mt-4 flex rounded-lg bg-secondary p-1 text-sm font-semibold">
              {(["post", "story"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-4 py-1.5 ${mode === m ? "bg-bg shadow-sm" : "text-muted"}`}
                >
                  {m === "post" ? "Post" : "Story"}
                </button>
              ))}
            </div>
          </div>
        )}

        {(step === "preview" || step === "details") && (
          <div className={`flex items-center justify-center bg-black ${wide ? "min-w-0 flex-1 max-md:aspect-square" : "flex-1"}`}>
            <div className={mode === "story" ? "aspect-[9/16] h-full" : "h-full w-full"}>
              <MediaCarousel media={files.map((f) => ({ url: f.url, kind: f.kind }))} fit="contain" dotsInside />
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="flex w-full flex-col border-l border-separator md:w-[340px]">
            <div className="flex items-center gap-3 p-4">
              <Avatar src={me.avatar} size={28} />
              <span className="font-semibold">{me.username}</span>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
              placeholder="Write a caption..."
              className="h-40 resize-none bg-transparent px-4 text-base outline-none placeholder:text-muted"
              autoFocus
            />
            <div className="border-b border-separator px-4 pb-2 text-right text-xs text-muted">
              {caption.length.toLocaleString()}/2,200
            </div>
            <label className="flex items-center gap-2 border-b border-separator px-4 py-3">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location"
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                maxLength={100}
              />
              <MapPin size={18} />
            </label>
          </div>
        )}

        {step === "sharing" && (
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-full p-1 story-ring" style={{ animation: "spin 1.2s linear infinite" }}>
              <div className="h-20 w-20 rounded-full bg-elevated p-1">
                <Spinner size={72} />
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <CircleCheck size={96} strokeWidth={1} className="text-[#ff3040]" />
            <p className="text-xl">{mode === "story" ? "Your story has been shared." : "Your post has been shared."}</p>
          </div>
        )}
      </div>

      {confirmDiscard && (
        <Modal onClose={() => setConfirmDiscard(false)} showClose={false} className="w-[400px] max-w-full">
          <div className="px-8 pb-6 pt-8 text-center">
            <h3 className="text-xl">Discard post?</h3>
            <p className="mt-1 text-muted">If you leave, your edits won&apos;t be saved.</p>
          </div>
          <button
            className="min-h-12 w-full border-t border-border text-sm font-bold text-danger"
            onClick={() => {
              setConfirmDiscard(false);
              if (step === "preview") {
                setFiles([]);
                setStep("pick");
              } else onClose();
            }}
          >
            Discard
          </button>
          <button className="min-h-12 w-full border-t border-border text-sm" onClick={() => setConfirmDiscard(false)}>
            Cancel
          </button>
        </Modal>
      )}
    </Modal>
  );
}

