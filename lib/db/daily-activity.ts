import { getDb } from "./index";
import { v4 as uuid } from "uuid";
import type { DailyActivity, ActionType } from "@/lib/utils/types";

export function createActivity(attrs: {
  user_id: string;
  action_type: ActionType;
  action_target?: string;
  points: number;
  note?: string;
}): DailyActivity {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(`
    INSERT INTO daily_activity (id, user_id, action_type, action_target, points, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, attrs.user_id, attrs.action_type, attrs.action_target ?? null, attrs.points, attrs.note ?? null, now);

  return {
    id,
    user_id: attrs.user_id,
    action_type: attrs.action_type,
    action_target: attrs.action_target ?? null,
    points: attrs.points,
    note: attrs.note ?? null,
    created_at: now,
  };
}

export function countActionToday(userId: string, actionType: ActionType): number {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM daily_activity WHERE user_id = ? AND action_type = ? AND date(created_at) = ?"
  ).get(userId, actionType, today) as { cnt: number };
  return row.cnt;
}

export function getTodayActivities(userId: string): DailyActivity[] {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare(
    "SELECT * FROM daily_activity WHERE user_id = ? AND date(created_at) = ? ORDER BY created_at DESC"
  ).all(userId, today) as DailyActivity[];
}

/** Returns the distinct dates (YYYY-MM-DD) a user had any activity, most recent first */
export function getRecentDates(userId: string, limit: number): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT DISTINCT date(created_at) as d FROM daily_activity WHERE user_id = ? ORDER BY d DESC LIMIT ?"
  ).all(userId, limit) as { d: string }[];
  return rows.map(r => r.d);
}

/** Count total activities of a given type (all time) — used for badge checks */
export function getActionCount(userId: string, actionType: ActionType): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM daily_activity WHERE user_id = ? AND action_type = ?"
  ).get(userId, actionType) as { cnt: number };
  return row.cnt;
}
