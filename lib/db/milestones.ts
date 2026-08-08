import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Milestone } from "@/lib/utils/types";

interface CreateMilestoneAttrs {
  track_id: string;
  title: string;
  description?: string;
  sort_order?: number;
}

export function createMilestone(attrs: CreateMilestoneAttrs): Milestone {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO milestones (id, track_id, title, description, sort_order, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, attrs.track_id, attrs.title, attrs.description || "", attrs.sort_order || 0, now);
  return db.prepare("SELECT * FROM milestones WHERE id = ?").get(id) as Milestone;
}

export function getMilestones(trackId: string): Milestone[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM milestones WHERE track_id = ? ORDER BY sort_order ASC"
  ).all(trackId) as Milestone[];
}

export function updateMilestone(id: string, attrs: { status?: string; completed_at?: string | null }): void {
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
  values.push(id);
  db.prepare(`UPDATE milestones SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}
