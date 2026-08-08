import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject, deleteProject } from "@/lib/db/projects";
import { getTracks } from "@/lib/db/tracks";
import { getMilestones } from "@/lib/db/milestones";
import { getTasks } from "@/lib/db/tasks";
import { addLog } from "@/lib/db/project-logs";
import { recordEvent } from "@/lib/engine/evidence-collector";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const tracks = getTracks(project.id);
  const tracksWithData = tracks.map(t => {
    const milestones = getMilestones(t.id).map(m => ({
      ...m,
      tasks: getTasks(m.id),
    }));
    return { ...t, milestones };
  });

  return NextResponse.json({ project: { ...project, tracks: tracksWithData } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const body = await req.json() as { title?: string; status?: string };
  const prevStatus = project.status;
  updateProject(params.id, body);

  // Record evidence events + project logs for status changes
  if (body.status === "completed" && prevStatus !== "completed") {
    recordEvent("persistence", "project_complete", "projects", params.id, {});
    addLog(params.id, "project_complete", "项目完成");
  } else if (body.status === "active" && prevStatus === "paused") {
    recordEvent("persistence", "project_resume", "projects", params.id, {});
    addLog(params.id, "project_resume", "项目恢复");
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  deleteProject(params.id);
  return NextResponse.json({ success: true });
}
