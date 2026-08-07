import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { SolutionPack, SolutionPackStatus } from "@/lib/utils/types";

export function createSolutionPack(attrs: {
  session_id: string;
  title: string;
  content: string;
}): SolutionPack {
  const db = getDb();
  const now = new Date().toISOString();

  // Get next version for this session
  const last = db.prepare(
    "SELECT MAX(version) as max_v FROM solution_packs WHERE session_id = ?"
  ).get(attrs.session_id) as { max_v: number | null };
  const version = (last?.max_v || 0) + 1;

  const pack: SolutionPack = {
    id: uuid(),
    session_id: attrs.session_id,
    version,
    title: attrs.title,
    content: attrs.content,
    status: "draft",
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO solution_packs (id, session_id, version, title, content, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(pack.id, pack.session_id, pack.version, pack.title, pack.content, pack.status, pack.created_at, pack.updated_at);
  return pack;
}

export function getSolutionPack(id: string): SolutionPack | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM solution_packs WHERE id = ?").get(id) as SolutionPack | undefined;
}

export function getSolutionPacksBySession(sessionId: string): SolutionPack[] {
  const db = getDb();
  return db.prepare("SELECT * FROM solution_packs WHERE session_id = ? ORDER BY version DESC").all(sessionId) as SolutionPack[];
}

export function updateSolutionPackStatus(id: string, status: SolutionPackStatus): void {
  const db = getDb();
  db.prepare("UPDATE solution_packs SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
}
