import type { AgeGroup, Project, Task } from "@/lib/utils/types";
import { getRecentLogs } from "@/lib/db/project-logs";
import { getCheckIns, getStreak } from "@/lib/db/check-ins";
import { getTasksByProject } from "@/lib/db/tasks";
import { routeModel } from "@/lib/models/router";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";

export interface ResumeContext {
  resume_text: string;
  next_task: Task | null;
  days_since_last_activity: number;
  streak: number;
}

export async function buildResume(
  project: Project,
  ageGroup: AgeGroup
): Promise<ResumeContext> {
  const logs = getRecentLogs(project.id, 3);
  const checkIns = getCheckIns(project.id);
  const tasks = getTasksByProject(project.id);
  const streak = getStreak(project.id);
  const nextTask = tasks.find(t => t.status !== "done") || null;

  // Days since last activity
  const latestLog = logs[0];
  const daysSince = latestLog
    ? Math.floor((Date.now() - new Date(latestLog.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const maxSentences = ageGroup === "6-9" ? 3 : ageGroup === "10-12" ? 4 : 5;

  const logSummary = logs.map(l => l.detail).join("；");
  const recentSummaries = checkIns.slice(-3).map(c => c.summary).join("；");

  const routed = routeModel("dialogue");
  if (!routed) {
    return {
      resume_text: `欢迎回来！${nextTask ? `接下来要：${nextTask.title}` : ""}已连续打卡 ${streak.current} 天。`,
      next_task: nextTask,
      days_since_last_activity: daysSince,
      streak: streak.current,
    };
  }

  const resumePrompt = `${buildSystemPrompt(ageGroup, 5)}

## 任务：欢迎孩子回来

孩子在做一个叫"${project.title}"的项目。
最近活动：${logSummary || "暂无"}
孩子说过：${recentSummaries || "暂无"}
下一个任务：${nextTask ? nextTask.title + " — " + nextTask.how_hint : "全部完成了！"}
连续打卡 ${streak.current} 天。${daysSince > 1 ? `已经 ${daysSince} 天没来了。` : ""}

请写一段 ${maxSentences} 句话以内的欢迎词，帮孩子回顾进度、鼓励继续。
${ageGroup === "6-9" ? "多用 emoji" : ""}`;

  try {
    const response = await routed.adapter.chat({
      messages: [
        { role: "system", content: resumePrompt },
        { role: "user", content: "欢迎我回来吧！" },
      ],
      max_tokens: 200,
    });
    return {
      resume_text: response || `欢迎回来！接下来要：${nextTask?.title || "回顾一下进度吧"}`,
      next_task: nextTask,
      days_since_last_activity: daysSince,
      streak: streak.current,
    };
  } catch {
    return {
      resume_text: `欢迎回来！${nextTask ? `接下来要：${nextTask.title}` : ""}已连续打卡 ${streak.current} 天。`,
      next_task: nextTask,
      days_since_last_activity: daysSince,
      streak: streak.current,
    };
  }
}
