import { route, HttpError } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { queryPosts } from "@/lib/server/queries";
import { userIdByUsername } from "@/lib/server/users";

// ?tab=posts (everything) | reels | saved (only for yourself)
export const GET = route(async (req, { params }: { params: Promise<{ username: string }> }) => {
  const me = await requireUser();
  const id = userIdByUsername((await params).username);
  const tab = new URL(req.url).searchParams.get("tab") ?? "posts";

  if (tab === "saved") {
    if (id !== me.id) throw new HttpError(403, "Only you can see what you've saved.");
    return {
      posts: queryPosts(
        me.id,
        "p.id IN (SELECT post_id FROM saves WHERE user_id = ?)",
        [me.id],
        "ORDER BY (SELECT created_at FROM saves WHERE user_id = :viewer AND post_id = p.id) DESC",
      ),
    };
  }
  const where = tab === "reels" ? "p.user_id = ? AND p.type = 'reel'" : "p.user_id = ?";
  return { posts: queryPosts(me.id, where, [id], "ORDER BY p.id DESC") };
});
