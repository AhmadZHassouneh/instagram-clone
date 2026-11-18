import { route, intParam, HttpError } from "@/lib/server/http";
import { run } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";

// Delete a comment: allowed for its author and for the owner of the post.
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const { changes } = run(
    `DELETE FROM comments WHERE id = ? AND (user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?))`,
    id,
    me.id,
    me.id,
  );
  if (!changes) throw new HttpError(404, "Comment not found.");
});
