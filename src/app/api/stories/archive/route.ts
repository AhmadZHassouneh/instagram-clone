import { route } from "@/lib/server/http";
import { all } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import type { Story } from "@/lib/types";

// All your stories, expired ones included, newest first (picked from when making a highlight).
export const GET = route(async () => {
  const me = await requireUser();
  const stories: Story[] = all<{ id: number; url: string; kind: "image" | "video"; created_at: number }>(
    "SELECT id, url, kind, created_at FROM stories WHERE user_id = ? ORDER BY id DESC",
    me.id,
  ).map((s) => ({ id: s.id, url: s.url, kind: s.kind, createdAt: s.created_at, seen: true }));
  return { stories };
});
