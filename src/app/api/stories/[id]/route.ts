import { route, intParam, HttpError } from "@/lib/server/http";
import { get, run } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { deleteUpload } from "@/lib/server/media";
import { queryUsers } from "@/lib/server/queries";

type Ctx = { params: Promise<{ id: string }> };

// Who viewed your story.
export const GET = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  if (!get("SELECT 1 FROM stories WHERE id = ? AND user_id = ?", id, me.id)) throw new HttpError(404, "Story not found.");
  return {
    users: queryUsers(
      me.id,
      "FROM story_views v JOIN users u ON u.id = v.user_id WHERE v.story_id = ? AND v.user_id != ? ORDER BY v.created_at DESC",
      [id, me.id],
    ),
  };
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const story = get<{ url: string }>("SELECT url FROM stories WHERE id = ? AND user_id = ?", id, me.id);
  if (!story) throw new HttpError(404, "Story not found.");
  run("DELETE FROM stories WHERE id = ?", id);
  await deleteUpload(story.url);
});
