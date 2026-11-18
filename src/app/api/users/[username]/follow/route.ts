import { route, HttpError } from "@/lib/server/http";
import { run, now } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { notify, unnotify } from "@/lib/server/queries";
import { userIdByUsername } from "@/lib/server/users";

type Ctx = { params: Promise<{ username: string }> };

export const POST = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const target = userIdByUsername((await params).username);
  if (target === me.id) throw new HttpError(400, "You can't follow yourself.");
  const { changes } = run(
    "INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)",
    me.id,
    target,
    now(),
  );
  if (changes) notify(target, me.id, "follow");
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const target = userIdByUsername((await params).username);
  run("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", me.id, target);
  unnotify(target, me.id, "follow");
});
