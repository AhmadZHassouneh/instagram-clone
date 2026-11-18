import { route } from "@/lib/server/http";
import { get } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";

// Badge counts for the navigation.
export const GET = route(async () => {
  const me = await requireUser();
  const notifications = get<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0", me.id)!.n;
  const messages = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM conversation_members cm
     WHERE cm.user_id = ? AND EXISTS (
       SELECT 1 FROM messages m WHERE m.conversation_id = cm.conversation_id AND m.id > cm.last_read_id AND m.sender_id != ?)`,
    me.id,
    me.id,
  )!.n;
  return { notifications, messages };
});
