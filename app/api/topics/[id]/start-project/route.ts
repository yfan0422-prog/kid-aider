import { getTopic, getActiveContent } from "@/lib/db/topics";
import { createProject, getProjectByTopic } from "@/lib/db/projects";
import { createTrack } from "@/lib/db/tracks";
import { createMilestone } from "@/lib/db/milestones";
import { createSession, getSession } from "@/lib/db/sessions";
import { createMessage } from "@/lib/db/messages";
import { addLog } from "@/lib/db/project-logs";
import { recordEvent } from "@/lib/engine/evidence-collector";
import { awardPoints } from "@/lib/engine/points-engine";
import { getOrCreateAccount } from "@/lib/db/user-account";
import type { AgeGroup, Challenge, TopicLanguage } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  // 1. Validate topic
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "error.topic_not_found" }, { status: 404 });
  }

  // 2. Parse body
  const body = (await req.json().catch(() => ({}))) as {
    project_name?: string;
    goto?: "project" | "chat";
    language?: TopicLanguage;
  };
  const projectName = body.project_name?.trim() || topic.title;
  const goto = body.goto === "chat" ? "chat" : "project";
  const language: TopicLanguage = body.language || topic.language;

  // 3. Get active content
  const content = getActiveContent(params.id, topic.age_group, language);
  if (!content) {
    return Response.json(
      { error: "error.no_content" },
      { status: 400 }
    );
  }

  // 4. Check for existing project (idempotency)
  const existing = getProjectByTopic(params.id);
  if (existing) {
    // Return existing project with its session (for goto="chat" callers)
    const existingSession = getSession(existing.session_id);
    return Response.json({
      project: existing,
      session: existingSession ? { id: existingSession.id } : undefined,
    });
  }

  // 5. Always create a session (FK constraint + future chat support)
  // topic.age_group can be "all" — normalize to a valid AgeGroup
  const sessionAgeGroup: AgeGroup =
    topic.age_group === "all" ? "10-12" : topic.age_group;
  const session = createSession({
    title: projectName,
    age_group: sessionAgeGroup,
  });

  // 6. Parse challenges
  const challenges: Challenge[] = JSON.parse(content.challenges);

  // 7. Create project
  const project = createProject({
    session_id: session.id,
    title: projectName,
    source: "topic",
    source_topic_id: params.id,
  });

  // 8. Create single track
  const track = createTrack({
    project_id: project.id,
    name: "默认轨道",
    type: "software",
    sort_order: 0,
  });

  // 9. challenges → milestones
  for (let i = 0; i < challenges.length; i++) {
    const ch = challenges[i];
    createMilestone({
      track_id: track.id,
      title: ch.title,
      description: ch.description,
      sort_order: i,
      challenge_json: JSON.stringify(ch),
    });
  }

  // 10. Seed chat session if goto === "chat"
  let sessionResponse: { id: string } | undefined;
  if (goto === "chat") {
    // Guide message: project_prompt seed
    const guideContent = content.project_prompt
      ? `太好了！你已经开始了一个关于"${topic.title}"的项目 🎉\n\n${content.project_prompt}\n\n让我们一起来把它想得更清楚！你可以问我任何关于这个项目的知识问题，或者让我帮忙把下一步想得更具体。`
      : `太好了！你已经开始了一个关于"${topic.title}"的项目 🎉\n\n让我们一起来把它想得更清楚！你可以问我任何关于这个项目的知识问题，或者让我帮忙把下一步想得更具体。`;

    createMessage({
      session_id: session.id,
      role: "guide",
      content: guideContent,
    });

    // System message: milestone context
    const milestoneLines = challenges.map(
      (ch) =>
        `- ${ch.title}（难度: ${"⭐".repeat(ch.difficulty)}，预计 ${ch.estimated_minutes} 分钟）`
    );
    createMessage({
      session_id: session.id,
      role: "system",
      content: `当前项目已有里程碑：\n${milestoneLines.join("\n")}`,
    });

    sessionResponse = { id: session.id };
  }

  // 11. Award points
  try {
    const account = getOrCreateAccount();
    awardPoints(account.id, "create_project", params.id);
  } catch (err) {
    console.error("[start-project] failed to award points:", err);
  }

  // 12. Log + evidence
  addLog(project.id, "task_done", `从话题"${topic.title}"创建项目`);
  recordEvent("creativity", "project_created_from_topic", "projects", project.id, {
    topic_id: params.id,
    title: projectName,
    milestone_count: challenges.length,
  });

  return Response.json(
    { project, session: sessionResponse },
    { status: 201 }
  );
}
