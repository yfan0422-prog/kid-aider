import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export async function GET() {
  const db = getDb();

  // Usage summary
  const usageSummary = db.prepare(
    "SELECT COALESCE(SUM(total_sec), 0) as total_sec, COUNT(*) as active_days FROM usage_log"
  ).get() as { total_sec: number; active_days: number };

  // Last 20 project logs
  const recentLogs = db.prepare(
    `SELECT pl.*, p.title as project_title
     FROM project_logs pl
     JOIN projects p ON p.id = pl.project_id
     ORDER BY pl.created_at DESC LIMIT 20`
  ).all();

  // Last 5 AI calls — look for chat response messages (role='guide')
  const recentAICalls = db.prepare(
    `SELECT id, role, created_at FROM messages
     WHERE role = 'guide'
     ORDER BY created_at DESC LIMIT 5`
  ).all() as Array<{ id: string; role: string; created_at: string }>;

  return NextResponse.json({
    usage_summary: {
      total_sec: usageSummary.total_sec,
      total_hours: Math.round(usageSummary.total_sec / 3600 * 10) / 10,
      active_days: usageSummary.active_days,
      avg_min_per_day: usageSummary.active_days > 0
        ? Math.round(usageSummary.total_sec / usageSummary.active_days / 60)
        : 0,
    },
    recent_logs: recentLogs,
    recent_ai_calls: recentAICalls,
  });
}
