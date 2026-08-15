import path from "path";
import { v4 as uuid } from "uuid";
import { getDb, getDataDir } from "./index";
import type { Work, WorkType } from "@/lib/utils/types";

/** 作品媒体根目录（<DATA_DIR>/media/works） */
export function worksRootDir(): string {
  return path.join(getDataDir(), "media", "works");
}

/** 将相对 DATA_DIR 的路径解析为绝对路径 */
export function resolveWorksPath(relPath: string): string {
  return path.join(getDataDir(), relPath);
}

export function createWork(input: {
  childId: string;
  type: WorkType;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  title?: string;
}): Work {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO works (id, child_id, type, file_path, mime_type, title, description, ai_encouragement, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?)
  `).run(id, input.childId, input.type, input.filePath, input.mimeType, input.title ?? "", input.sizeBytes, now);
  return getWork(id)!;
}

export function listWorks(childId: string): Work[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM works WHERE child_id = ? ORDER BY created_at DESC"
  ).all(childId) as Work[];
}

export function getWork(id: string): Work | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM works WHERE id = ?").get(id) as Work) ?? null;
}

export function updateWorkMeta(
  id: string,
  fields: { title?: string; description?: string; aiEncouragement?: string }
): Work | null {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.title !== undefined) { sets.push("title = ?"); values.push(fields.title); }
  if (fields.description !== undefined) { sets.push("description = ?"); values.push(fields.description); }
  if (fields.aiEncouragement !== undefined) { sets.push("ai_encouragement = ?"); values.push(fields.aiEncouragement); }
  if (sets.length === 0) return getWork(id);
  values.push(id);
  db.prepare(`UPDATE works SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getWork(id);
}

/** 删除单作品，返回其相对路径供调用方删除文件；不存在返回 null */
export function deleteWork(id: string): { filePath: string } | null {
  const db = getDb();
  const row = db.prepare("SELECT file_path FROM works WHERE id = ?").get(id) as { file_path: string } | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM works WHERE id = ?").run(id);
  return { filePath: row.file_path };
}

/** 删除某孩子全部作品行，返回被删文件的相对路径数组 */
export function deleteWorksByChild(childId: string): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT file_path FROM works WHERE child_id = ?").all(childId) as { file_path: string }[];
  db.prepare("DELETE FROM works WHERE child_id = ?").run(childId);
  return rows.map((r) => r.file_path);
}
