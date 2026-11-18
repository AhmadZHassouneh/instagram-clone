import { route, intParam } from "@/lib/server/http";
import { run, now } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";

export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  run("INSERT OR IGNORE INTO story_views (story_id, user_id, created_at) SELECT id, ?, ? FROM stories WHERE id = ?", me.id, now(), id);
});
