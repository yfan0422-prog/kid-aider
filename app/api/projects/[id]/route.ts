import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject, deleteProject } from "@/lib/db/projects";
import { getTracks } from "@/lib/db/tracks";
import { getMilestones } from "@/lib/db/milestones";
import { getTasks } from "@/lib/db/tasks";

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
  updateProject(params.id, body);
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
