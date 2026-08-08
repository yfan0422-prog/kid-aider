import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { CompetencyDimension, CompetencySnapshot } from "@/lib/utils/types";

export function upsertSnapshot(
  weekStart: string,
  dimension: CompetencyDimension,
  score: number,
  scoreType: "rule" | "ai",
  evidence: string
): CompetencySnapshot {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.prepare(
    "SELECT id FROM competency_snapshots WHERE week_start = ? AND dimension = ?"
  ).get(weekStart, dimension) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE competency_snapshots SET score = ?, score_type = ?, evidence = ?, created_at = ?
       WHERE id = ?`
    ).run(score, scoreType, evidence, now, existing.id);
    return db.prepare(
      "SELECT * FROM competency_snapshots WHERE id = ?"
    ).get(existing.id) as CompetencySnapshot;
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO competency_snapshots (id, week_start, dimension, score, score_type, evidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, weekStart, dimension, score, scoreType, evidence, now);

  return db.prepare(
    "SELECT * FROM competency_snapshots WHERE id = ?"
  ).get(id) as CompetencySnapshot;
}

export function getLatestSnapshots(): CompetencySnapshot[] {
  const db = getDb();
  return db.prepare(
    `SELECT cs.* FROM competency_snapshots cs
     JOIN (SELECT dimension, MAX(week_start) as max_week
           FROM competency_snapshots GROUP BY dimension) latest
     ON cs.dimension = latest.dimension AND cs.week_start = latest.max_week`
  ).all() as CompetencySnapshot[];
}

export function getSnapshotsByRange(
  startWeek: string,
  endWeek: string
): CompetencySnapshot[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM competency_snapshots
     WHERE week_start >= ? AND week_start <= ?
     ORDER BY week_start ASC, dimension ASC`
  ).all(startWeek, endWeek) as CompetencySnapshot[];
}
