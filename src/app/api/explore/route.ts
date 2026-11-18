import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { queryPosts } from "@/lib/server/queries";

// Popular posts from everyone except yourself.
export const GET = route(async () => {
  const me = await requireUser();
  return {
    posts: queryPosts(
      me.id,
      "p.user_id != ?",
      [me.id],
      `ORDER BY ((SELECT COUNT(*) FROM likes WHERE post_id = p.id) * 2
                + (SELECT COUNT(*) FROM comments WHERE post_id = p.id) * 3
                + p.created_at / 3600000.0) DESC LIMIT 60`,
    ),
  };
});
