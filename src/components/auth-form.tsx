"use client";

import { useState } from "react";

/** Instagram's floating-label input used on the login and sign-up pages. */
export function AuthInput({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  valid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  valid?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="relative flex h-[38px] items-center rounded-[3px] border border-border bg-secondary/40 focus-within:border-muted">
      <span
        className={`pointer-events-none absolute left-2 origin-left truncate text-muted transition-transform ${
          value ? "-translate-y-[9px] scale-[0.83] text-[12px]" : "text-xs"
        }`}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={isPassword && !show ? "password" : isPassword ? "text" : type}
        autoComplete={autoComplete}
        aria-label={label}
        className={`h-full min-w-0 flex-1 bg-transparent px-2 text-xs outline-none ${value ? "pt-[14px] pb-0.5" : ""}`}
      />
      {valid !== undefined && value && (
        <span className={`mr-2 text-lg ${valid ? "text-muted" : "text-danger"}`}>{valid ? "✓" : "✕"}</span>
      )}
      {isPassword && value && (
        <button type="button" onClick={() => setShow((s) => !s)} className="mr-2 text-sm font-semibold hover:opacity-60">
          {show ? "Hide" : "Show"}
        </button>
      )}
    </label>
  );
}

export function Divider() {
  return (
    <div className="my-4 flex items-center gap-4 text-[13px] font-semibold text-muted">
      <span className="h-px flex-1 bg-border" />
      OR
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
