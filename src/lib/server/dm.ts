import "server-only";
import { all, db, get, run, now, tx } from "./db";
import { addWelcomeMessage } from "../../../db/welcome.mjs";
import { HttpError } from "./http";
import { firstMedia, userLite } from "./queries";
import type { InvoiceCard, Message, MessageKind, UserLite } from "@/lib/types";

/** Returns the 1:1 conversation between two users, creating it if needed. */
export function conversationBetween(a: number, b: number): number {
  const existing = get<{ id: number }>(
    `SELECT c.id FROM conversations c
     JOIN conversation_members x ON x.conversation_id = c.id AND x.user_id = ?
     JOIN conversation_members y ON y.conversation_id = c.id AND y.user_id = ?
     LIMIT 1`,
    a,
    b,
  );
  if (existing) return existing.id;
  return tx(() => {
    const t = now();
    const { id } = run("INSERT INTO conversations (created_at, updated_at) VALUES (?, ?)", t, t);
    run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)", id, a, id, b);
    addWelcomeMessage(db(), id);
    return id;
  });
}

/** The highest message id the other participant has read (for "Seen"). */
export function otherLastRead(conversationId: number, viewerId: number): number {
  return (
    get<{ last_read_id: number }>(
      "SELECT last_read_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?",
      conversationId,
      viewerId,
    )?.last_read_id ?? 0
  );
}

/** The other participant, or a 404 when the viewer isn't in this conversation. */
export function otherMember(conversationId: number, viewerId: number): UserLite {
  if (!get("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?", conversationId, viewerId))
    throw new HttpError(404, "Conversation not found.");
  const r = get<{ uid: number; username: string; name: string; avatar: string | null; verified: number }>(
    `SELECT u.id AS uid, u.username, u.name, u.avatar, u.verified FROM conversation_members cm
     JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ? AND cm.user_id != ?`,
    conversationId,
    viewerId,
  );
  if (!r) throw new HttpError(404, "Conversation not found.");
  return userLite(r);
}

export function sendMessage(conversationId: number, senderId: number, text: string, postId: number | null = null) {
  const t = now();
  const { id } = run(
    "INSERT INTO messages (conversation_id, sender_id, kind, text, post_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    conversationId,
    senderId,
    postId ? "post" : "text",
    text,
    postId,
    t,
  );
  run("UPDATE conversations SET updated_at = ? WHERE id = ?", t, conversationId);
  run("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?", id, conversationId, senderId);
  return id;
}

/** Unsends (deletes) a message. Only its sender may do this; invoices, receipts and the welcome message stay. */
export function unsendMessage(messageId: number, userId: number) {
  const m = get<{ sender_id: number; kind: MessageKind }>("SELECT sender_id, kind FROM messages WHERE id = ?", messageId);
  if (!m || m.sender_id !== userId) throw new HttpError(404, "Message not found.");
  if (m.kind === "invoice" || m.kind === "receipt") throw new HttpError(400, "Invoices and receipts can't be unsent.");
  if (m.kind === "welcome") throw new HttpError(400, "The welcome message can't be unsent. Edit it in src/config/welcome-message.mjs.");
  run("DELETE FROM messages WHERE id = ?", messageId);
}

/** Ids of every message still in the conversation, so open threads can drop unsent ones. */
export function messageIds(conversationId: number): number[] {
  return all<{ id: number }>("SELECT id FROM messages WHERE conversation_id = ? ORDER BY id", conversationId).map((r) => r.id);
}

type InvoiceRow = {
  id: number;
  number: string;
  kind: "invoice" | "receipt";
  issued_at: number;
  total_fils: number;
  currency: string;
  payment_method: string;
  payment_reference: string;
  paid_at: number | null;
  is_seed: number;
  i_id: number;
  i_username: string;
  i_name: string;
  i_avatar: string | null;
  i_verified: number;
  i_category: string;
  r_id: number;
  r_username: string;
  r_name: string;
  r_avatar: string | null;
  r_verified: number;
};

/** Invoice/receipt cards with their line items, by invoice id. */
export function loadInvoices(ids: number[]): Map<number, InvoiceCard> {
  const out = new Map<number, InvoiceCard>();
  if (!ids.length) return out;
  const marks = ids.map(() => "?").join(",");
  const rows = all<InvoiceRow>(
    `SELECT v.*, i.id AS i_id, i.username AS i_username, i.name AS i_name, i.avatar AS i_avatar,
       i.verified AS i_verified, i.business_category AS i_category,
       r.id AS r_id, r.username AS r_username, r.name AS r_name, r.avatar AS r_avatar, r.verified AS r_verified
     FROM invoices v JOIN users i ON i.id = v.issuer_id JOIN users r ON r.id = v.recipient_id
     WHERE v.id IN (${marks})`,
    ...ids,
  );
  const items = all<{ invoice_id: number; description: string; quantity: number; unit_fils: number }>(
    `SELECT invoice_id, description, quantity, unit_fils FROM invoice_items WHERE invoice_id IN (${marks}) ORDER BY position`,
    ...ids,
  );
  for (const r of rows) {
    out.set(r.id, {
      id: r.id,
      number: r.number,
      kind: r.kind,
      issuer: {
        ...userLite({ uid: r.i_id, username: r.i_username, name: r.i_name, avatar: r.i_avatar, verified: r.i_verified }),
        businessCategory: r.i_category,
      },
      recipient: userLite({ uid: r.r_id, username: r.r_username, name: r.r_name, avatar: r.r_avatar, verified: r.r_verified }),
      issuedAt: r.issued_at,
      items: items
        .filter((i) => i.invoice_id === r.id)
        .map((i) => ({ description: i.description, quantity: i.quantity, unitFils: i.unit_fils })),
      totalFils: r.total_fils,
      currency: r.currency,
      paymentMethod: r.payment_method,
      paymentReference: r.payment_reference,
      paidAt: r.paid_at,
      isSeed: !!r.is_seed,
    });
  }
  return out;
}

/** Messages in time order (the welcome message is dated at the conversation's start even when added later). */
export function loadMessages(conversationId: number, afterId = 0): Message[] {
  const rows = all<{
    id: number;
    sender_id: number;
    kind: MessageKind;
    invoice_id: number | null;
    voice_seconds: number | null;
    text: string;
    post_id: number | null;
    created_at: number;
    p_caption: string | null;
    uid: number | null;
    username: string;
    name: string;
    avatar: string | null;
    verified: number;
  }>(
    `SELECT m.id, m.sender_id, m.kind, m.invoice_id, m.voice_seconds, m.text, m.post_id, m.created_at, p.caption AS p_caption,
       u.id AS uid, u.username, u.name, u.avatar, u.verified
     FROM messages m
     LEFT JOIN posts p ON p.id = m.post_id
     LEFT JOIN users u ON u.id = p.user_id
     WHERE m.conversation_id = ? AND m.id > ? ORDER BY m.created_at, m.id`,
    conversationId,
    afterId,
  );
  const invoices = loadInvoices(rows.flatMap((r) => (r.invoice_id ? [r.invoice_id] : [])));
  return rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    kind: r.kind,
    text: r.text,
    createdAt: r.created_at,
    invoice: r.invoice_id ? (invoices.get(r.invoice_id) ?? null) : null,
    voiceSeconds: r.voice_seconds,
    post:
      r.post_id && r.uid
        ? { id: r.post_id, caption: r.p_caption ?? "", thumb: firstMedia(r.post_id), user: userLite({ ...r, uid: r.uid }) }
        : null,
  }));
}
