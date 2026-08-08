import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Task } from "@/lib/utils/types";

interface CreateTaskAttrs {
  milestone_id: string;
  title: string;
  what_to_do: string;
  how_hint?: string;
  difficulty?: number;
}

export function createTask(attrs: CreateTaskAttrs): Task {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO tasks (id, milestone_id, title, what_to_do, how_hint, difficulty, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, attrs.milestone_id, attrs.title, attrs.what_to_do, attrs.how_hint || "", attrs.difficulty || 1, now);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task;
}

export function getTasks(milestoneId: string): Task[] {
  const db = getDb();
  return db.prepare("SELECT * FROM tasks WHERE milestone_id = ? ORDER BY difficulty ASC, created_at ASC").all(milestoneId) as Task[];
}

export function getTask(id: string): Task | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return row ? (row as Task) : undefined;
}

export function toggleTaskDone(id: string): Task | null {
  const db = getDb();
  const task = getTask(id);
  if (!task) return null;
  const newStatus = task.status === "done" ? "pending" : "done";
  const completedAt = newStatus === "done" ? new Date().toISOString() : null;
  db.prepare("UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?").run(newStatus, completedAt, id);
  return getTask(id)!;
}

export function getTasksByProject(projectId: string): Task[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.* FROM tasks t
    JOIN milestones m ON t.milestone_id = m.id
    JOIN tracks tr ON m.track_id = tr.id
    WHERE tr.project_id = ? ORDER BY t.status ASC, t.difficulty ASC
  `).all(projectId) as Task[];
}
