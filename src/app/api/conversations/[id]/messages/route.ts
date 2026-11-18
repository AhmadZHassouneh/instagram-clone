import { route, intParam, jsonBody, HttpError } from "@/lib/server/http";
import { run } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { loadMessages, messageIds, otherLastRead, otherMember, sendMessage } from "@/lib/server/dm";

type Ctx = { params: Promise<{ id: string }> };

// Messages in a conversation; ?after=<message id> returns only newer ones (used for live polling).
// `ids` lists every message still present so open threads can drop ones that were unsent.
export const GET = route(async (req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  const other = otherMember(id, me.id);
  const after = Number(new URL(req.url).searchParams.get("after")) || 0;
  const messages = loadMessages(id, after);
  if (messages.length)
    run(
      "UPDATE conversation_members SET last_read_id = MAX(last_read_id, ?) WHERE conversation_id = ? AND user_id = ?",
      Math.max(...messages.map((m) => m.id)),
      id,
      me.id,
    );
  return { other, messages, ids: messageIds(id), otherLastReadId: otherLastRead(id, me.id) };
});

export const POST = route(async (req, { params }: Ctx) => {
  const me = await requireUser();
  const id = intParam((await params).id);
  otherMember(id, me.id);
  const text = String((await jsonBody<{ text: string }>(req)).text ?? "").trim().slice(0, 1000);
  if (!text) throw new HttpError(400, "Write a message first.");
  const messageId = sendMessage(id, me.id, text);
  return { message: loadMessages(id, messageId - 1).find((m) => m.id === messageId) };
});
