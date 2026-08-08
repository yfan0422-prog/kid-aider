import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Track, TrackType } from "@/lib/utils/types";

interface CreateTrackAttrs {
  project_id: string;
  name: string;
  type: TrackType;
  sort_order?: number;
}

export function createTrack(attrs: CreateTrackAttrs): Track {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO tracks (id, project_id, name, type, sort_order, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`
  ).run(id, attrs.project_id, attrs.name, attrs.type, attrs.sort_order || 0, now);
  return db.prepare("SELECT * FROM tracks WHERE id = ?").get(id) as Track;
}

export function getTracks(projectId: string): Track[] {
  const db = getDb();
  return db.prepare("SELECT * FROM tracks WHERE project_id = ? ORDER BY sort_order ASC").all(projectId) as Track[];
}

export function deleteTrack(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM tracks WHERE id = ?").run(id);
}
