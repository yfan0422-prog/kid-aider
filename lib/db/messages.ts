import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Message, MessageRole } from "@/lib/utils/types";

export function createMessage(attrs: {
  session_id: string;
  role: MessageRole;
  content: string;
  strategy_id?: string | null;
}): Message {
  const db = getDb();
  const message: Message = {
    id: uuid(),
    session_id: attrs.session_id,
    role: attrs.role,
    content: attrs.content,
    strategy_id: attrs.strategy_id || null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, strategy_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(message.id, message.session_id, message.role, message.content, message.strategy_id, message.created_at);
  return message;
}

export function getMessages(sessionId: string): Message[] {
  const db = getDb();
  return db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC").all(sessionId) as Message[];
}

export function getRecentMessages(sessionId: string, limit = 20): Message[] {
  const db = getDb();
  return db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?").all(sessionId, limit).reverse() as Message[];
}
