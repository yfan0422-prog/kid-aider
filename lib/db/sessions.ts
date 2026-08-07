import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Session, AgeGroup, SessionStatus } from "@/lib/utils/types";

export function createSession(attrs: {
  title?: string;
  age_group?: AgeGroup;
}): Session {
  const db = getDb();
  const now = new Date().toISOString();
  const session: Session = {
    id: uuid(),
    title: attrs.title || "",
    age_group: attrs.age_group || "10-12",
    status: "active",
    funnel_step: 0,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO sessions (id, title, age_group, status, funnel_step, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(session.id, session.title, session.age_group, session.status, session.funnel_step, session.created_at, session.updated_at);
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

export function deleteSession(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}
