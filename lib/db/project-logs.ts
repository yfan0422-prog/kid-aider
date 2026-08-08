import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { ProjectLog } from "@/lib/utils/types";

export function addLog(projectId: string, action: string, detail: string): ProjectLog {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    "INSERT INTO project_logs (id, project_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, projectId, action, detail, now);
  return { id, project_id: projectId, action, detail, created_at: now };
}

export function getRecentLogs(projectId: string, limit: number = 3): ProjectLog[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(projectId, limit) as ProjectLog[];
}

export function getLogsByProject(projectId: string): ProjectLog[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId) as ProjectLog[];
}
