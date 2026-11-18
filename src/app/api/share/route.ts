import { route, jsonBody, HttpError } from "@/lib/server/http";
import { get } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { conversationBetween, sendMessage } from "@/lib/server/dm";

// Send a post to one or more people by DM: { postId, userIds, text? }.
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await jsonBody<{ postId: number; userIds: number[]; text: string }>(req);
  const postId = Number(body.postId);
  if (!get("SELECT 1 FROM posts WHERE id = ?", postId)) throw new HttpError(404, "Post not found.");
  const userIds = (body.userIds ?? []).map(Number).filter((id) => id !== me.id);
  if (userIds.length === 0) throw new HttpError(400, "Choose someone to send this to.");
  const text = String(body.text ?? "").trim().slice(0, 1000);

  for (const userId of userIds) {
    if (!get("SELECT 1 FROM users WHERE id = ?", userId)) continue;
    const conversationId = conversationBetween(me.id, userId);
    sendMessage(conversationId, me.id, "", postId);
    if (text) sendMessage(conversationId, me.id, text);
  }
});
