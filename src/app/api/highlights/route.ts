import { route, jsonBody, HttpError } from "@/lib/server/http";
import { all, run, now, tx } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";

// New highlight from some of your stories: { title, storyIds }.
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await jsonBody<{ title: string; storyIds: number[] }>(req);
  const title = String(body.title ?? "").trim().slice(0, 15) || "Highlights";
  const wanted = (Array.isArray(body.storyIds) ? body.storyIds : []).map(Number).filter(Number.isInteger);
  if (wanted.length === 0) throw new HttpError(400, "Choose at least one story.");

  const owned = all<{ id: number }>(
    `SELECT id FROM stories WHERE user_id = ? AND id IN (${wanted.map(() => "?").join(",")})`,
    me.id,
    ...wanted,
  ).map((r) => r.id);
  if (owned.length === 0) throw new HttpError(400, "Choose at least one story.");

  const id = tx(() => {
    const h = run("INSERT INTO highlights (user_id, title, created_at) VALUES (?, ?, ?)", me.id, title, now());
    for (const storyId of owned) run("INSERT INTO highlight_items (highlight_id, story_id) VALUES (?, ?)", h.id, storyId);
    return h.id;
  });
  return { id };
});
