import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { queryPosts } from "@/lib/server/queries";

export const GET = route(async (req) => {
  const me = await requireUser();
  const start = Number(new URL(req.url).searchParams.get("start")) || 0;
  // A specific reel first (when opened from a link), then the rest newest first.
  const posts = queryPosts(me.id, "p.type = 'reel'", [], `ORDER BY (p.id = ${start}) DESC, p.id DESC LIMIT 50`);
  return { posts };
});
