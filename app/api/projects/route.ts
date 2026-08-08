import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db/projects";
import { createTrack } from "@/lib/db/tracks";
import { createMilestone } from "@/lib/db/milestones";
import { createTask } from "@/lib/db/tasks";
import { addLog } from "@/lib/db/project-logs";
import { decomposeSolutionPack } from "@/lib/engine/project-decomposer";
import { recordEvent } from "@/lib/engine/evidence-collector";
import type { AgeGroup } from "@/lib/utils/types";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const { sessionId, ageGroup } = await req.json() as { sessionId: string; ageGroup?: AgeGroup };

  // Get latest solution pack title for project name
  const decomposed = await decomposeSolutionPack(sessionId, ageGroup || "10-12");
  if (!decomposed || decomposed.tracks.length === 0) {
    return NextResponse.json({ error: "未找到方案包或拆解失败" }, { status: 400 });
  }

  // Extract title from solution pack (via DB lookback)
  const { getDb } = await import("@/lib/db/index");
  const db = getDb();
  const packs = db.prepare(
    "SELECT title FROM solution_packs WHERE session_id = ? ORDER BY version DESC LIMIT 1"
  ).all(sessionId) as Array<{ title: string }>;
  const title = packs[0]?.title || "未命名项目";

  // Create project
  const project = createProject({ session_id: sessionId, title });

  // Create tracks, milestones, tasks from decomposed result
  for (let ti = 0; ti < decomposed.tracks.length; ti++) {
    const dt = decomposed.tracks[ti];
    const track = createTrack({
      project_id: project.id,
      name: dt.name,
      type: dt.type,
      sort_order: ti,
    });

    for (let mi = 0; mi < dt.milestones.length; mi++) {
      const dm = dt.milestones[mi];
      const milestone = createMilestone({
        track_id: track.id,
        title: dm.title,
        sort_order: mi,
      });

      for (const dtask of dm.tasks) {
        createTask({
          milestone_id: milestone.id,
          title: dtask.title,
          what_to_do: dtask.what_to_do,
          how_hint: dtask.how_hint,
          difficulty: dtask.difficulty,
        });
      }
    }
  }

  // Record decomposition evidence — track/milestone/task counts
  const stats = { tracks: decomposed.tracks.length, milestones: 0, tasks: 0 };
  for (const t of decomposed.tracks) {
    stats.milestones += t.milestones.length;
    for (const m of t.milestones) stats.tasks += m.tasks.length;
  }
  recordEvent("decomposition", "project_decomposed", "projects", project.id, stats);

  addLog(project.id, "task_done", "项目创建成功");

  // Record evidence event
  recordEvent("creativity", "project_created", "projects", project.id, { title });

  return NextResponse.json({ project: { ...project, tracks: decomposed.tracks } }, { status: 201 });
}
