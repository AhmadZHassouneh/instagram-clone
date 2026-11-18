import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { queryUsers } from "@/lib/server/queries";

export const GET = route(async (req) => {
  const me = await requireUser();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/^@/, "");
  if (!q) return { users: [] };
  const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  return {
    users: queryUsers(
      me.id,
      `FROM users u WHERE u.username LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\'
       ORDER BY (u.username LIKE ? ESCAPE '\\') DESC,
         (SELECT COUNT(*) FROM follows WHERE following_id = u.id) DESC LIMIT 30`,
      [like, like, `${like.slice(1)}`],
    ),
  };
});
