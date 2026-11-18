"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { AuthInput, Divider } from "@/components/auth-form";
import { Logo } from "@/components/nav";

export default function SignupPage() {
  const [form, setForm] = useState({ email: "", password: "", name: "", username: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: k === "username" ? v.toLowerCase().replace(/\s/g, "") : v }));

  const valid = {
    email: /^\S+@\S+\.\S+$/.test(form.email),
    password: form.password.length >= 6,
    username: /^[a-z0-9._]{1,30}$/.test(form.username),
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/signup", { body: form });
      window.location.replace("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[350px]">
      <div className="mb-2.5 border-separator px-10 pb-6 pt-10 sm:border">
        <h1 className="mb-3 mt-2 text-center">
          <Logo className="text-[46px]" />
        </h1>
        <p className="mb-2 text-center text-base font-semibold text-muted">
          Sign up to see photos and videos from your friends.
        </p>
        <Divider />
        <form onSubmit={submit} className="flex flex-col gap-1.5">
          <AuthInput label="Email" value={form.email} onChange={set("email")} type="email" autoComplete="email" valid={valid.email} />
          <AuthInput label="Password" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" valid={valid.password} />
          <AuthInput label="Full Name" value={form.name} onChange={set("name")} autoComplete="name" />
          <AuthInput label="Username" value={form.username} onChange={set("username")} autoComplete="username" valid={valid.username} />
          <p className="my-2.5 text-center text-xs text-muted">
            By signing up, you agree to our Terms, Privacy Policy and Cookies Policy.
          </p>
          <button
            disabled={!valid.email || !valid.password || !valid.username || busy}
            className="rounded-lg bg-link py-[7px] text-sm font-semibold text-white hover:bg-link-hover disabled:opacity-70"
          >
            {busy ? "Signing up..." : "Sign up"}
          </button>
        </form>
        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
      </div>
      <div className="border-separator py-5 text-center sm:border">
        Have an account?{" "}
        <Link href="/accounts/login" className="font-semibold text-link">
          Log in
        </Link>
      </div>
    </div>
  );
}
