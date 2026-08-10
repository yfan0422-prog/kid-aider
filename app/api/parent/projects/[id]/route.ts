import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getProject, updateProject } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "error.project_not_found" }, { status: 404 });
  }

  const db = getDb();

  // Get session + messages
  let messages: Array<{ role: string; content: string; created_at: string }> = [];
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(project.session_id) as Record<string, unknown> | undefined;
  if (session) {
    messages = db.prepare(
      "SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC"
    ).all(project.session_id) as Array<{ role: string; content: string; created_at: string }>;
  }

  // Get project structure: tracks → milestones → tasks
  const tracks = db.prepare("SELECT * FROM tracks WHERE project_id = ? ORDER BY sort_order ASC").all(params.id) as Array<Record<string, unknown>>;
  const structure = tracks.map(track => {
    const milestones = db.prepare("SELECT * FROM milestones WHERE track_id = ? ORDER BY sort_order ASC").all(track.id) as Array<Record<string, unknown>>;
    return {
      ...track,
      milestones: milestones.map(m => ({
        ...m,
        tasks: db.prepare("SELECT * FROM tasks WHERE milestone_id = ? ORDER BY created_at ASC").all(m.id),
      })),
    };
  });

  // Get check-ins and reflections
  const checkIns = db.prepare("SELECT * FROM check_ins WHERE project_id = ? ORDER BY date DESC").all(params.id);
  const reflections = db.prepare("SELECT * FROM reflections WHERE project_id = ? ORDER BY created_at DESC").all(params.id);

  // Get project logs
  const logs = db.prepare("SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC").all(params.id);

  return NextResponse.json({
    project,
    session,
    messages,
    structure,
    check_ins: checkIns,
    reflections,
    logs,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { status } = await req.json() as { status: string };
  updateProject(params.id, { status });
  return NextResponse.json({ ok: true });
}
