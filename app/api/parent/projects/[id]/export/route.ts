import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getDb } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const db = getDb();
  const checkIns = db.prepare("SELECT * FROM check_ins WHERE project_id = ?").all(params.id);
  const reflections = db.prepare("SELECT * FROM reflections WHERE project_id = ?").all(params.id);
  const logs = db.prepare("SELECT * FROM project_logs WHERE project_id = ?").all(params.id);

  const messages = db.prepare(
    "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"
  ).all(project.session_id);

  const exportData = {
    exported_at: new Date().toISOString(),
    version: "1.0",
    project,
    check_ins: checkIns,
    reflections,
    project_logs: logs,
    messages,
  };

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="project-${params.id}.json"`,
    },
  });
}
