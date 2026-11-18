import { route, intParam, HttpError } from "@/lib/server/http";
import { get, run, now } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  if (!get("SELECT 1 FROM posts WHERE id = ?", id)) throw new HttpError(404, "Post not found.");
  run("INSERT OR IGNORE INTO saves (user_id, post_id, created_at) VALUES (?, ?, ?)", me.id, id, now());
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  run("DELETE FROM saves WHERE user_id = ? AND post_id = ?", me.id, id);
});
