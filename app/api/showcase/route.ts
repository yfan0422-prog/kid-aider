import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getEarnedBadges, initBadges } from "@/lib/db/badges";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  // Get completed projects
  const projects = db.prepare(
    "SELECT * FROM projects WHERE status = 'completed' ORDER BY updated_at DESC"
  ).all() as Array<{ id: string; title: string; created_at: string; updated_at: string }>;

  // Get earned badges for display
  initBadges();
  const earnedBadges = getEarnedBadges();
  const badgeMap = earnedBadges.map(b => ({ icon: b.icon, label: b.label }));

  // For each project, compute stats
  const result = projects.map(p => {
    // Active days (distinct check-in dates)
    const daysRow = db.prepare(
      "SELECT COUNT(DISTINCT date) as count FROM check_ins WHERE project_id = ?"
    ).get(p.id) as { count: number };

    // Tasks done
    const tasksRow = db.prepare(
      `SELECT COUNT(*) as count FROM tasks
       JOIN milestones ON milestones.id = tasks.milestone_id
       JOIN tracks ON tracks.id = milestones.track_id
       WHERE tracks.project_id = ? AND tasks.status = 'done'`
    ).get(p.id) as { count: number };

    return {
      id: p.id,
      title: p.title,
      days: daysRow.count,
      tasksDone: tasksRow.count,
      badges: badgeMap,
    };
  });

  return NextResponse.json({ projects: result });
}
