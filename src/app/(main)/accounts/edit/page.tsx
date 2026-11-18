"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/client";
import type { Me } from "@/lib/types";
import { useApp } from "@/components/app-context";
import { Avatar, OptionsMenu, PrimaryButton } from "@/components/ui";

export default function EditProfilePage() {
  const { me, setMe, toast } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({ name: me.name, username: me.username, website: me.website, bio: me.bio, email: me.email });
  const [saving, setSaving] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const changed = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== me[k]);

  const send = async (fd: FormData) => {
    const { user } = await api<{ user: Me }>("/api/me", { method: "PATCH", body: fd });
    setMe(user);
    return user;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const user = await send(fd);
      toast("Profile saved.");
      if (user.username !== me.username) router.replace(`/${user.username}`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      await send(fd);
      toast("Profile photo added.");
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const field = (key: keyof typeof form, label: string, help?: string, multiline = false) => (
    <label className="block">
      <span className="mb-2 block text-base font-bold">{label}</span>
      {multiline ? (
        <div className="relative">
          <textarea
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value.slice(0, 150) })}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-transparent px-4 py-3 outline-none focus:border-fg/50"
          />
          <span className="absolute bottom-3 right-4 text-xs text-muted">{form[key].length} / 150</span>
        </div>
      ) : (
        <input
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-xl border border-border bg-transparent px-4 py-3 outline-none focus:border-fg/50"
        />
      )}
      {help && <span className="mt-1 block text-xs text-muted">{help}</span>}
    </label>
  );

  return (
    <div className="mx-auto max-w-[700px] px-4 pb-10 md:px-8 md:pt-9">
      <header className="-mx-4 mb-4 flex h-11 items-center border-b border-separator px-2 md:hidden">
        <button onClick={() => router.back()} aria-label="Back">
          <ChevronLeft size={28} />
        </button>
        <h1 className="flex-1 pr-7 text-center text-base font-semibold">Edit profile</h1>
      </header>
      <h1 className="mb-8 hidden text-xl font-bold md:block">Edit profile</h1>

      <div className="mb-8 flex items-center gap-4 rounded-2xl bg-secondary p-4">
        <Avatar src={me.avatar} size={56} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">{me.username}</div>
          <div className="truncate text-muted">{me.name}</div>
        </div>
        <PrimaryButton onClick={() => (me.avatar ? setPhotoMenu(true) : fileInput.current?.click())}>Change photo</PrimaryButton>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            uploadPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <form onSubmit={save} className="space-y-6">
        {field("name", "Name", "Help people discover your account by using the name you're known by.")}
        {field("username", "Username")}
        {field("website", "Website")}
        {field("bio", "Bio", undefined, true)}
        {field("email", "Email", "Only you can see this.")}
        <div className="flex justify-end">
          <PrimaryButton disabled={!changed || saving} className="w-full px-12 py-3 md:w-auto">
            {saving ? "Saving..." : "Submit"}
          </PrimaryButton>
        </div>
      </form>

      {photoMenu && (
        <OptionsMenu
          onClose={() => setPhotoMenu(false)}
          options={[
            { label: "Upload Photo", bold: true, onClick: () => (setPhotoMenu(false), fileInput.current?.click()) },
            {
              label: "Remove Current Photo",
              danger: true,
              onClick: async () => {
                setPhotoMenu(false);
                const fd = new FormData();
                fd.append("removeAvatar", "1");
                await send(fd);
                toast("Profile photo removed.");
              },
            },
          ]}
        />
      )}
    </div>
  );
}
