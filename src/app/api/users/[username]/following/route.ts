import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { queryUsers } from "@/lib/server/queries";
import { userIdByUsername } from "@/lib/server/users";

export const GET = route(async (_req, { params }: { params: Promise<{ username: string }> }) => {
  const me = await requireUser();
  const id = userIdByUsername((await params).username);
  return {
    users: queryUsers(
      me.id,
      "FROM follows f JOIN users u ON u.id = f.following_id WHERE f.follower_id = ? ORDER BY f.created_at DESC",
      [id],
    ),
  };
});
