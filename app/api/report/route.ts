import { NextRequest, NextResponse } from "next/server";
import { getSnapshotsByRange } from "@/lib/db/competency-snapshots";
import { getEarnedBadges } from "@/lib/db/badges";
import { getDb } from "@/lib/db/index";
import { getCurrentWeekStart } from "@/lib/engine/evidence-collector";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const weeks = parseInt(url.searchParams.get("weeks") || "4", 10);

  const currentWeekStart = getCurrentWeekStart();
  const startDate = new Date(currentWeekStart);
  startDate.setDate(startDate.getDate() - (weeks - 1) * 7);
  const startWeek = startDate.toISOString().slice(0, 10);

  const snapshots = getSnapshotsByRange(startWeek, currentWeekStart);

  // Group by week_start
  const trends: Array<{ week_start: string; scores: Record<string, number> }> = [];
  const weekMap = new Map<string, Record<string, number>>();
  for (const s of snapshots) {
    if (!weekMap.has(s.week_start)) weekMap.set(s.week_start, {});
    weekMap.get(s.week_start)![s.dimension] = s.score;
  }
  for (const [ws, scores] of Array.from(weekMap)) {
    trends.push({ week_start: ws, scores });
  }
  trends.sort((a, b) => a.week_start.localeCompare(b.week_start));

  // Project summary
  const db = getDb();
  const projectStats = db.prepare(
    `SELECT
       COUNT(*) as total_projects,
       COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed_projects
     FROM projects`
  ).get() as { total_projects: number; completed_projects: number };

  const taskStats = db.prepare(
    `SELECT
       COUNT(*) as total,
       COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) as done
     FROM tasks`
  ).get() as { total: number; done: number };

  const badges = getEarnedBadges();

  // Current streak
  const checkIns = db.prepare(
    "SELECT DISTINCT date FROM check_ins ORDER BY date DESC"
  ).all() as Array<{ date: string }>;
  let currentStreak = 0;
  if (checkIns.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const latestDate = checkIns[0].date;
    // Only count streak if latest check-in is today or yesterday
    const diffToNow = Math.round(
      (new Date(today).getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffToNow <= 1) {
      currentStreak = 1;
      for (let i = 1; i < checkIns.length; i++) {
        const prev = new Date(checkIns[i - 1].date);
        const curr = new Date(checkIns[i].date);
        const diff = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) currentStreak++;
        else break;
      }
    }
  }

  return NextResponse.json({
    time_range: {
      start: startWeek,
      end: currentWeekStart,
    },
    trends,
    summary: {
      total_projects: projectStats.total_projects,
      completed_projects: projectStats.completed_projects,
      total_tasks: taskStats.total,
      total_tasks_done: taskStats.done,
      task_completion_rate: taskStats.total > 0
        ? Math.round((taskStats.done / taskStats.total) * 100) / 100
        : 0,
      badges_earned: badges.length,
      current_streak: currentStreak,
    },
  });
}
