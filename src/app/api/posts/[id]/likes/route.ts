import { route, intParam } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { queryUsers } from "@/lib/server/queries";

// People who liked a post.
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  return {
    users: queryUsers(me.id, "FROM likes l JOIN users u ON u.id = l.user_id WHERE l.post_id = ? ORDER BY l.created_at DESC", [id]),
  };
});
