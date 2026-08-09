import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const tables: Record<string, string> = {
    sessions: "sessions",
    messages: "messages",
    projects: "projects",
    tracks: "tracks",
    milestones: "milestones",
    tasks: "tasks",
    check_ins: "check_ins",
    reflections: "reflections",
    project_logs: "project_logs",
    competency_snapshots: "competency_snapshots",
    badges: "badges",
    evidence_events: "evidence_events",
    usage_log: "usage_log",
  };

  const data: Record<string, unknown[]> = {};
  for (const [key, table] of Object.entries(tables)) {
    let query = `SELECT * FROM ${table}`;
    const conditions: string[] = [];
    const params: string[] = [];

    if (from && to && tableHasColumn(table)) {
      const col = tableTimeColumn(table);
      if (col) {
        conditions.push(`${col} >= ? AND ${col} <= ?`);
        params.push(from, to);
      }
    }

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    data[key] = db.prepare(query).all(...params);
  }

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    version: "1.0",
    date_range: from && to ? { from, to } : "all",
    tables: data,
  }, {
    headers: {
      "Content-Disposition": "attachment; filename=kid-aider-export.json",
    },
  });
}

function tableHasColumn(table: string): boolean {
  return ["sessions", "messages", "projects", "tasks", "check_ins", "reflections",
    "project_logs", "competency_snapshots", "badges", "evidence_events", "usage_log"].includes(table);
}

function tableTimeColumn(table: string): string | null {
  const map: Record<string, string> = {
    sessions: "created_at", messages: "created_at", projects: "created_at",
    tasks: "created_at", check_ins: "date", reflections: "created_at",
    project_logs: "created_at", competency_snapshots: "week_start",
    badges: "earned_at", evidence_events: "created_at", usage_log: "date",
  };
  return map[table] || null;
}
