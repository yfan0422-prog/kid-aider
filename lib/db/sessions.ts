import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Session, AgeGroup } from "@/lib/utils/types";

export function createSession(attrs: {
  title?: string;
  age_group?: AgeGroup;
  child_id?: string;
}): Session {
  const db = getDb();
  const now = new Date().toISOString();
  const session: Session = {
    id: uuid(),
    title: attrs.title || "",
    age_group: attrs.age_group || "10-12",
    status: "active",
    funnel_step: 0,
    child_id: attrs.child_id || "",
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO sessions (id, title, age_group, status, funnel_step, child_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(session.id, session.title, session.age_group, session.status, session.funnel_step, session.child_id, session.created_at, session.updated_at);
  return session;
}

export function getSession(id: string): Session | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session | undefined;
}

export function updateSession(id: string, attrs: Partial<Pick<Session, "title" | "status" | "funnel_step" | "age_group">>): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function listSessions(limit = 20): Session[] {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?").all(limit) as Session[];
}

/** 列出某个孩子的历史会话（带最后一条孩子消息预览），按最近更新倒序 */
export function listSessionsByChild(childId: string, limit = 50): (Session & { preview: string })[] {
  const db = getDb();
  return db.prepare(
    `SELECT s.*,
       COALESCE(
         (SELECT m.content FROM messages m
           WHERE m.session_id = s.id AND m.role = 'child'
           ORDER BY m.created_at DESC LIMIT 1),
         ''
       ) AS preview
     FROM sessions s
     WHERE s.child_id = ?
     ORDER BY s.updated_at DESC
     LIMIT ?`
  ).all(childId, limit) as (Session & { preview: string })[];
}

export function deleteSession(id: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    // 清理仅以 session_id 关联、无外键级联的日志表
    db.prepare("DELETE FROM voice_sessions WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM emotion_log WHERE session_id = ?").run(id);
    // messages / requirement_nodes / solution_packs 通过外键 ON DELETE CASCADE 自动清理
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  });
  tx();
}
