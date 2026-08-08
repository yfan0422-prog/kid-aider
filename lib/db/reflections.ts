import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Reflection, ReflectionType } from "@/lib/utils/types";

interface CreateReflectionAttrs {
  project_id: string;
  type: ReflectionType;
  trigger_ref?: string | null;
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
}

export function createReflection(attrs: CreateReflectionAttrs): Reflection {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO reflections (id, project_id, type, trigger_ref, q1, q2, q3, q4, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, attrs.project_id, attrs.type, attrs.trigger_ref || null, attrs.q1 || "", attrs.q2 || "", attrs.q3 || "", attrs.q4 || "", now);
  return db.prepare("SELECT * FROM reflections WHERE id = ?").get(id) as Reflection;
}

export function getReflections(projectId: string): Reflection[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM reflections WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId) as Reflection[];
}
