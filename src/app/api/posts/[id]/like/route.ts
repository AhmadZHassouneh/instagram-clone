import { route, intParam, HttpError } from "@/lib/server/http";
import { get, run, now } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { notify, unnotify } from "@/lib/server/queries";

type Ctx = { params: Promise<{ id: string }> };

function postOwner(id: number) {
  const post = get<{ user_id: number }>("SELECT user_id FROM posts WHERE id = ?", id);
  if (!post) throw new HttpError(404, "Post not found.");
  return post.user_id;
}

export const POST = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const owner = postOwner(id);
  const { changes } = run("INSERT OR IGNORE INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)", me.id, id, now());
  if (changes) notify(owner, me.id, "like", id);
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const owner = postOwner(id);
  run("DELETE FROM likes WHERE user_id = ? AND post_id = ?", me.id, id);
  unnotify(owner, me.id, "like", id);
});
