import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { all } from "@/lib/server/db";
import { queryUsers } from "@/lib/server/queries";

// People you don't follow yet, ranked by how many of the people you follow follow them.
export const GET = route(async (req) => {
  const me = await requireUser();
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 5, 50);
  const users = queryUsers(
    me.id,
    `FROM users u
     WHERE u.id != ? AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
     ORDER BY (SELECT COUNT(*) FROM follows f JOIN follows mine ON mine.following_id = f.follower_id AND mine.follower_id = ?
               WHERE f.following_id = u.id) DESC,
              (SELECT COUNT(*) FROM follows WHERE following_id = u.id) DESC
     LIMIT ${limit}`,
    [me.id, me.id, me.id],
  );

  // A short "Followed by x" / "Follows you" reason for each suggestion.
  const reasons = Object.fromEntries(
    users.map((u) => {
      const mutual = all<{ username: string }>(
        `SELECT m.username FROM follows f
           JOIN follows mine ON mine.following_id = f.follower_id AND mine.follower_id = ?
           JOIN users m ON m.id = f.follower_id
         WHERE f.following_id = ? LIMIT 2`,
        me.id,
        u.id,
      ).map((r) => r.username);
      const followsYou = all("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?", u.id, me.id).length > 0;
      return [u.id, followsYou ? "Follows you" : mutual.length ? `Followed by ${mutual.join(", ")}` : "Suggested for you"];
    }),
  );
  return { users: users.map((u) => ({ ...u, reason: reasons[u.id] })) };
});
