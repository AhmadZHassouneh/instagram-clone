import { route, intParam, HttpError } from "@/lib/server/http";
import { get, run } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { notify, unnotify } from "@/lib/server/queries";

type Ctx = { params: Promise<{ id: string }> };

function comment(id: number) {
  const c = get<{ user_id: number; post_id: number; text: string }>(
    "SELECT user_id, post_id, text FROM comments WHERE id = ?",
    id,
  );
  if (!c) throw new HttpError(404, "Comment not found.");
  return c;
}

export const POST = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const c = comment(id);
  const { changes } = run("INSERT OR IGNORE INTO comment_likes (user_id, comment_id) VALUES (?, ?)", me.id, id);
  if (changes) notify(c.user_id, me.id, "comment_like", c.post_id, c.text);
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const c = comment(id);
  run("DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?", me.id, id);
  unnotify(c.user_id, me.id, "comment_like", c.post_id);
});
