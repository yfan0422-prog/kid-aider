import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { UsageLog } from "@/lib/utils/types";

export function getUsageLogs(from: string, to: string): UsageLog[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM usage_log WHERE date >= ? AND date <= ? ORDER BY date ASC"
  ).all(from, to) as UsageLog[];
}

export function getTodayUsageSec(): number {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(
    "SELECT total_sec FROM usage_log WHERE date = ?"
  ).get(today) as { total_sec: number } | undefined;
  return row?.total_sec || 0;
}

export function recordUsageTime(date: string, deltaSec: number): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM usage_log WHERE date = ?").get(date);
  if (existing) {
    db.prepare("UPDATE usage_log SET total_sec = total_sec + ? WHERE date = ?").run(deltaSec, date);
  } else {
    db.prepare("INSERT INTO usage_log (id, date, total_sec) VALUES (?, ?, ?)").run(uuid(), date, deltaSec);
  }
}
