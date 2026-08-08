import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { CheckIn } from "@/lib/utils/types";

export function upsertCheckIn(projectId: string, summary: string): CheckIn {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const existing = db.prepare(
    "SELECT * FROM check_ins WHERE project_id = ? AND date = ?"
  ).get(projectId, today) as CheckIn | undefined;

  if (existing) {
    db.prepare("UPDATE check_ins SET summary = ? WHERE id = ?").run(summary, existing.id);
    return { ...existing, summary };
  }

  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    "INSERT INTO check_ins (id, project_id, date, summary, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, projectId, today, summary, now);
  return { id, project_id: projectId, date: today, summary, created_at: now };
}

export function getCheckIns(projectId: string): CheckIn[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM check_ins WHERE project_id = ? ORDER BY date ASC"
  ).all(projectId) as CheckIn[];
}

export function getStreak(projectId: string): { current: number; longest: number } {
  const checkIns = getCheckIns(projectId);
  const dates = new Set(checkIns.map(c => c.date));
  const today = new Date();

  // Count consecutive days backwards from today
  let current = 0;
  const d = new Date(today);
  while (dates.has(d.toISOString().slice(0, 10))) {
    current++;
    d.setDate(d.getDate() - 1);
  }

  // Find longest streak in history
  let longest = 0;
  let streak = 0;
  const sorted = Array.from(dates).sort();
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { streak = 1; continue; }
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) { streak++; } else { streak = 1; }
    longest = Math.max(longest, streak);
  }
  longest = Math.max(longest, streak, current);

  return { current, longest };
}
