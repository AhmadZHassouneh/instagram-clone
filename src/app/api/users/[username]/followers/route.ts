import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { queryUsers } from "@/lib/server/queries";
import { userIdByUsername } from "@/lib/server/users";

// ?mutual=1 lists only followers that you follow too ("Followed by …").
export const GET = route(async (req, { params }: { params: Promise<{ username: string }> }) => {
  const me = await requireUser();
  const id = userIdByUsername((await params).username);
  const mutual = new URL(req.url).searchParams.get("mutual") === "1";
  return {
    users: queryUsers(
      me.id,
      `FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.following_id = ?
       ${mutual ? "AND f.follower_id IN (SELECT following_id FROM follows WHERE follower_id = ?)" : ""}
       ORDER BY f.created_at DESC`,
      mutual ? [id, me.id] : [id],
    ),
  };
});
