import { route, jsonBody, HttpError } from "@/lib/server/http";
import { all } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { userLite } from "@/lib/server/queries";
import { userIdByUsername } from "@/lib/server/users";
import { conversationBetween } from "@/lib/server/dm";
import type { Conversation, MessageKind } from "@/lib/types";

export const GET = route(async () => {
  const me = await requireUser();
  const rows = all<{
    id: number;
    updated_at: number;
    last_read_id: number;
    uid: number;
    username: string;
    name: string;
    avatar: string | null;
    verified: number;
    m_id: number | null;
    m_text: string | null;
    m_sender: number | null;
    m_kind: MessageKind;
    m_at: number | null;
  }>(
    `SELECT c.id, c.updated_at, me.last_read_id,
       u.id AS uid, u.username, u.name, u.avatar, u.verified,
       m.id AS m_id, m.text AS m_text, m.sender_id AS m_sender, m.kind AS m_kind, m.created_at AS m_at
     FROM conversation_members me
     JOIN conversations c ON c.id = me.conversation_id
     JOIN conversation_members other ON other.conversation_id = c.id AND other.user_id != me.user_id
     JOIN users u ON u.id = other.user_id
     LEFT JOIN messages m ON m.id = (SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1)
     WHERE me.user_id = ?
     ORDER BY c.updated_at DESC`,
    me.id,
  );
  const conversations: Conversation[] = rows
    // Hide empty threads you opened but never wrote in.
    .filter((r) => r.m_id !== null)
    .map((r) => ({
      id: r.id,
      other: userLite(r),
      updatedAt: r.updated_at,
      lastMessage: {
        text: r.m_text ?? "",
        senderId: r.m_sender!,
        createdAt: r.m_at!,
        kind: r.m_kind,
      },
      unread: r.m_sender !== me.id && r.m_id! > r.last_read_id,
    }));
  return { conversations };
});

// Open (or create) a conversation with a user: { username }.
export const POST = route(async (req) => {
  const me = await requireUser();
  const username = String((await jsonBody<{ username: string }>(req)).username ?? "");
  const other = userIdByUsername(username);
  if (other === me.id) throw new HttpError(400, "You can't message yourself.");
  return { id: conversationBetween(me.id, other) };
});
