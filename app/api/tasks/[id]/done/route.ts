import { NextRequest, NextResponse } from "next/server";
import { toggleTaskDone, getTask } from "@/lib/db/tasks";
import { updateMilestone } from "@/lib/db/milestones";
import { addLog } from "@/lib/db/project-logs";
import { getDb } from "@/lib/db/index";
import { recordEvent } from "@/lib/engine/evidence-collector";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const task = getTask(params.id);
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  const updated = toggleTaskDone(params.id);
  if (!updated) {
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }

  addLog(
    // Get project_id via joins
    (getDb().prepare(`
      SELECT tr.project_id FROM tracks tr
      JOIN milestones m ON m.track_id = tr.id
      WHERE m.id = ? LIMIT 1
    `).get(task.milestone_id) as { project_id: string }).project_id,
    updated.status === "done" ? "task_done" : "task_undo",
    updated.title
  );

  // Only record evidence on actual completion, not undo
  if (updated.status === "done") {
    recordEvent("execution", "task_done", "tasks", updated.id, {
      title: updated.title,
    });
  }

  // Check if milestone is now complete
  let milestoneComplete = false;
  if (updated.status === "done") {
    const db = getDb();
    const pending = db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE milestone_id = ? AND status != 'done'"
    ).get(task.milestone_id) as { count: number };

    if (pending.count === 0) {
      updateMilestone(task.milestone_id, {
        status: "done",
        completed_at: new Date().toISOString(),
      });
      milestoneComplete = true;
    }
  }

  return NextResponse.json({
    task: { id: updated.id, status: updated.status, completed_at: updated.completed_at },
    milestone_complete: milestoneComplete,
  });
}
