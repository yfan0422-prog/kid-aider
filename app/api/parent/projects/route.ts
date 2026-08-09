import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const sort = searchParams.get("sort") || "updated";

  let query = "SELECT * FROM projects";
  const conditions: string[] = [];
  const params: string[] = [];

  if (statusFilter) {
    conditions.push("status = ?");
    params.push(statusFilter);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += sort === "created" ? " ORDER BY created_at DESC" : " ORDER BY updated_at DESC";

  const projects = db.prepare(query).all(...params) as Array<{
    id: string; title: string; status: string; created_at: string; updated_at: string;
  }>;

  // Attach task progress for each project
  const result = projects.map(p => {
    const taskStats = db.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
       FROM tasks t
       JOIN milestones m ON m.id = t.milestone_id
       JOIN tracks tr ON tr.id = m.track_id
       WHERE tr.project_id = ?`
    ).get(p.id) as { total: number; done: number };

    return {
      ...p,
      tasks_total: taskStats.total,
      tasks_done: taskStats.done,
    };
  });

  return NextResponse.json({ projects: result });
}
