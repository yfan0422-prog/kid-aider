import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Project } from "@/lib/utils/types";

interface CreateProjectAttrs {
  session_id: string;
  title: string;
}

export function createProject(attrs: CreateProjectAttrs): Project {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO projects (id, session_id, title, status, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?)`
  ).run(id, attrs.session_id, attrs.title, now, now);
  return getProject(id)!;
}

export function getProject(id: string): Project | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return row ? (row as Project) : undefined;
}

export function listProjects(): Project[] {
  const db = getDb();
  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Project[];
}

export function updateProject(id: string, attrs: { title?: string; status?: string }): void {
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
  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteProject(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}
