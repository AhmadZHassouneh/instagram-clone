import { route, intParam, HttpError } from "@/lib/server/http";
import { all, get, run } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { userLite } from "@/lib/server/queries";
import type { StoryGroup } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

// A highlight's stories, shaped like a story group so the story viewer can play it.
export const GET = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const h = get<{ title: string; uid: number; username: string; name: string; avatar: string | null; verified: number }>(
    `SELECT h.title, u.id AS uid, u.username, u.name, u.avatar, u.verified
     FROM highlights h JOIN users u ON u.id = h.user_id WHERE h.id = ?`,
    id,
  );
  if (!h) throw new HttpError(404, "This highlight is no longer available.");
  const stories = all<{ id: number; url: string; kind: "image" | "video"; created_at: number; seen: number }>(
    `SELECT s.id, s.url, s.kind, s.created_at,
       EXISTS (SELECT 1 FROM story_views WHERE story_id = s.id AND user_id = ?) AS seen
     FROM highlight_items i JOIN stories s ON s.id = i.story_id
     WHERE i.highlight_id = ? ORDER BY s.id`,
    me.id,
    id,
  ).map((s) => ({ id: s.id, url: s.url, kind: s.kind, createdAt: s.created_at, seen: !!s.seen }));
  if (stories.length === 0) throw new HttpError(404, "This highlight is no longer available.");
  const group: StoryGroup = { user: userLite(h), stories, allSeen: stories.every((s) => s.seen) };
  return { title: h.title, group };
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  if (run("DELETE FROM highlights WHERE id = ? AND user_id = ?", id, me.id).changes === 0) {
    throw new HttpError(404, "Highlight not found.");
  }
});
