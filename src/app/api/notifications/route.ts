import { route } from "@/lib/server/http";
import { all, run } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { firstMedia, userLite } from "@/lib/server/queries";
import type { Notification } from "@/lib/types";

export const GET = route(async () => {
  const me = await requireUser();
  const rows = all<{
    id: number;
    type: Notification["type"];
    text: string;
    created_at: number;
    read: number;
    post_id: number | null;
    uid: number;
    username: string;
    name: string;
    avatar: string | null;
    verified: number;
    is_following: number;
  }>(
    `SELECT n.id, n.type, n.text, n.created_at, n.read, n.post_id,
       u.id AS uid, u.username, u.name, u.avatar, u.verified,
       EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) AS is_following
     FROM notifications n JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 100`,
    me.id,
    me.id,
  );
  const notifications: Notification[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    text: r.text,
    createdAt: r.created_at,
    read: !!r.read,
    actor: { ...userLite(r), isFollowing: !!r.is_following },
    post: r.post_id ? { id: r.post_id, thumb: firstMedia(r.post_id) } : null,
  }));
  return { notifications };
});

// Mark everything as read.
export const POST = route(async () => {
  const me = await requireUser();
  run("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", me.id);
});
