import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db/index";
import type { CompetencyDimension, EvidenceEvent } from "@/lib/utils/types";

export function recordEvent(
  dimension: CompetencyDimension,
  eventType: string,
  sourceTable: string,
  sourceId: string,
  payload?: Record<string, unknown>
): EvidenceEvent {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const payloadJson = JSON.stringify(payload || {});

  db.prepare(
    `INSERT INTO evidence_events (id, dimension, event_type, source_table, source_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, dimension, eventType, sourceTable, sourceId, payloadJson, now);

  return {
    id,
    dimension,
    event_type: eventType,
    source_table: sourceTable,
    source_id: sourceId,
    payload: payloadJson,
    created_at: now,
  };
}

export function getEventsForWeek(
  weekStart: string,
  dimension?: CompetencyDimension
): EvidenceEvent[] {
  const db = getDb();
  const weekEnd = new Date(
    new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  if (dimension) {
    return db.prepare(
      `SELECT * FROM evidence_events
       WHERE dimension = ? AND created_at >= ? AND created_at < ?
       ORDER BY created_at ASC`
    ).all(dimension, weekStart, weekEnd) as EvidenceEvent[];
  }

  return db.prepare(
    `SELECT * FROM evidence_events
     WHERE created_at >= ? AND created_at < ?
     ORDER BY created_at ASC`
  ).all(weekStart, weekEnd) as EvidenceEvent[];
}

/** Get this week's Monday as YYYY-MM-DD */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 1
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  // Use local date components, not UTC serialization
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
