import { getDb } from "./index";
import type { CompetencyDimension, EvidenceEvent } from "@/lib/utils/types";

export function getEventsByDimension(
  dimension: CompetencyDimension,
  since: string
): EvidenceEvent[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM evidence_events
     WHERE dimension = ? AND created_at >= ?
     ORDER BY created_at ASC`
  ).all(dimension, since) as EvidenceEvent[];
}

export function getWeekEvents(weekStart: string): EvidenceEvent[] {
  const db = getDb();
  const weekEnd = new Date(
    new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  return db.prepare(
    `SELECT * FROM evidence_events
     WHERE created_at >= ? AND created_at < ?
     ORDER BY created_at ASC`
  ).all(weekStart, weekEnd) as EvidenceEvent[];
}

export function hasWeekEvents(weekStart: string): boolean {
  const db = getDb();
  const weekEnd = new Date(
    new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  const row = db.prepare(
    "SELECT COUNT(*) as count FROM evidence_events WHERE created_at >= ? AND created_at < ?"
  ).get(weekStart, weekEnd) as { count: number };
  return row.count > 0;
}
