import { route } from "@/lib/server/http";
import { all } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { userIdByUsername } from "@/lib/server/users";
import type { Highlight } from "@/lib/types";

// A profile's highlights, oldest first like Instagram. The cover is its custom cover image, else its first story.
export const GET = route(async (_req, { params }: { params: Promise<{ username: string }> }) => {
  await requireUser();
  const id = userIdByUsername((await params).username);
  const rows = all<{ id: number; title: string; url: string; kind: "image" | "video" }>(
    `SELECT h.id, h.title, COALESCE(h.cover_url, s.url) AS url, CASE WHEN h.cover_url IS NULL THEN s.kind ELSE 'image' END AS kind
     FROM highlights h
     JOIN stories s ON s.id = (SELECT story_id FROM highlight_items WHERE highlight_id = h.id ORDER BY story_id LIMIT 1)
     WHERE h.user_id = ? ORDER BY h.id`,
    id,
  );
  const highlights: Highlight[] = rows.map((r) => ({ id: r.id, title: r.title, cover: { url: r.url, kind: r.kind } }));
  return { highlights };
});
