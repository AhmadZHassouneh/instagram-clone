// Puts the welcome message (src/config/welcome-message.mjs) at the start of conversations.
// Welcome messages have kind = 'welcome', so each conversation gets exactly one however the text changes.
import { WELCOME_MESSAGE, WELCOME_SENDER_USERNAME } from "../src/config/welcome-message.mjs";

/** @typedef {import("node:sqlite").DatabaseSync} DatabaseSync */

/** @param {DatabaseSync} db */
function senderId(db) {
  return /** @type {{ id: number } | undefined} */ (db.prepare("SELECT id FROM users WHERE username = ?").get(WELCOME_SENDER_USERNAME))?.id;
}

/**
 * Adds the welcome message to one conversation, dated at its creation, unless it already has one
 * or the sender isn't a member. Other members who had read everything stay fully read.
 * @param {DatabaseSync} db
 * @param {number} conversationId
 */
export function addWelcomeMessage(db, conversationId, sender = senderId(db)) {
  if (!sender) return;
  if (!db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?").get(conversationId, sender)) return;
  if (db.prepare("SELECT 1 FROM messages WHERE conversation_id = ? AND kind = 'welcome'").get(conversationId)) return;
  // Dated at the conversation's creation, but never at or after its first message, so it always sorts first.
  const { at } = /** @type {{ at: number }} */ (
    db.prepare(
      `SELECT MIN(c.created_at, COALESCE((SELECT MIN(created_at) - 1 FROM messages WHERE conversation_id = c.id), c.created_at)) AS at
       FROM conversations c WHERE c.id = ?`,
    ).get(conversationId)
  );
  const prevMax = /** @type {{ m: number | null }} */ (db.prepare("SELECT MAX(id) AS m FROM messages WHERE conversation_id = ?").get(conversationId)).m ?? 0;
  const id = Number(
    db.prepare("INSERT INTO messages (conversation_id, sender_id, kind, text, created_at) VALUES (?, ?, 'welcome', ?, ?)")
      .run(conversationId, sender, WELCOME_MESSAGE, at).lastInsertRowid,
  );
  // Only members who had read everything move past it; the sender's own message never counts as unread.
  if (prevMax)
    db.prepare("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id != ? AND last_read_id >= ?").run(
      id,
      conversationId,
      sender,
      prevMax,
    );
}

/**
 * Gives every conversation the sender is in a welcome message, and updates existing ones to the current text.
 * @param {DatabaseSync} db
 */
export function ensureWelcomeMessages(db) {
  const sender = senderId(db);
  if (!sender) return;
  const missing = /** @type {{ conversation_id: number }[]} */ (
    db.prepare(
      `SELECT cm.conversation_id FROM conversation_members cm
       WHERE cm.user_id = ? AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = cm.conversation_id AND m.kind = 'welcome')`,
    ).all(sender)
  );
  db.exec("BEGIN");
  try {
    for (const { conversation_id } of missing) addWelcomeMessage(db, conversation_id, sender);
    db.prepare("UPDATE messages SET text = ? WHERE kind = 'welcome' AND text != ?").run(WELCOME_MESSAGE, WELCOME_MESSAGE);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
