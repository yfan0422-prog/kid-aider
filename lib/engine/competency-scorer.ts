import type { CompetencyDimension, CompetencySnapshot, EvidenceEvent } from "@/lib/utils/types";
import { getWeekEvents } from "@/lib/db/evidence-events";
import { upsertSnapshot } from "@/lib/db/competency-snapshots";
import { getDb } from "@/lib/db/index";
import { routeModel } from "@/lib/models/router";

// ── Rule-engine scores ──────────────────────────────────────────

export function computeExecutionScore(weekStart: string): number {
  const db = getDb();

  // Task completion rate (all time until week end)
  const weekEnd = new Date(
    new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  const taskStats = db.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'done' AND completed_at < ? THEN 1 ELSE 0 END) as done
     FROM tasks`
  ).get(weekEnd) as { total: number; done: number };

  const taskRate = taskStats.total > 0 ? taskStats.done / taskStats.total : 0;

  // Check-in rate (this week)
  const activeProjects = db.prepare(
    "SELECT COUNT(*) as count FROM projects WHERE status IN ('active', 'paused')"
  ).get() as { count: number };

  const checkInsThisWeek = db.prepare(
    `SELECT COUNT(DISTINCT date) as count FROM check_ins
     WHERE date >= ? AND date < ?`
  ).get(weekStart, weekEnd) as { count: number };

  const checkInRate = activeProjects.count > 0
    ? Math.min(1, checkInsThisWeek.count / (activeProjects.count * 7))
    : 0;

  return Math.min(100, Math.round(taskRate * 60 + checkInRate * 40));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- persistence formula is cumulative, weekStart intentionally unused
export function computePersistenceScore(_weekStart: string): number {
  const db = getDb();

  // Active days: count distinct check-in days, capped at 60
  const checkInDays = db.prepare(
    "SELECT COUNT(DISTINCT date) as count FROM check_ins"
  ).get() as { count: number };
  const activeDaysScore = Math.min(60, Math.round(checkInDays.count / 7 * 10));

  // Resume count: number of times a project was reactivated from 'paused'
  const logResumeCount = db.prepare(
    "SELECT COUNT(*) as count FROM project_logs WHERE action = 'project_resume'"
  ).get() as { count: number };
  const resumeScore = Math.min(40, logResumeCount.count * 10);

  return Math.min(100, activeDaysScore + resumeScore);
}

// ── AI qualitative evaluation ────────────────────────────────────

const DIMENSION_LABELS: Record<CompetencyDimension, string> = {
  clarification: "需求澄清力",
  decomposition: "分解力",
  execution: "执行力",
  reflection: "反思力",
  creativity: "创造力",
  persistence: "坚持力",
};

const DIMENSION_CRITERIA: Record<CompetencyDimension, string> = {
  clarification: "能否清晰表达想要什么、能区分“想要”和“需要”、能否细化模糊想法",
  decomposition: "能否把大目标拆成小步骤、步骤之间逻辑是否合理",
  execution: "任务完成频率和打卡规律性",
  reflection: "回答是否具体（不是“挺好的”）、能否指出具体困难、是否有改进想法",
  creativity: "想法是否多样、是否有原创性、是否尝试不同角度",
  persistence: "项目持续天数、中断后恢复次数",
};

async function evaluateWithAI(
  dimension: CompetencyDimension,
  events: EvidenceEvent[]
): Promise<{ score: number; summary: string; evidence: Array<{ quote: string; source: string; weight: string }> } | null> {
  const routed = routeModel("dialogue");
  if (!routed || events.length === 0) {
    return { score: 50, summary: "数据不足，继续加油！", evidence: [] };
  }

  const eventsJson = JSON.stringify(
    events.map(e => ({
      type: e.event_type,
      source: `${e.source_table}.${e.source_id}`,
      payload: JSON.parse(e.payload),
    }))
  );

  const prompt = `你是 Kid-Aider 的${DIMENSION_LABELS[dimension]}评估教练。
根据以下孩子的行为数据，给出 0-100 的评分。

评分标准：
${DIMENSION_CRITERIA[dimension]}

数据：
${eventsJson}

返回 JSON（不要 markdown 代码块）：
{
  "score": 0-100,
  "summary": "一段对孩子说的话（50字以内，鼓励为主）",
  "evidence": [
    {"quote": "来自数据的原句引用", "source": "表名.字段名", "weight": "high|medium|low"}
  ]
}`;

  try {
    const response = await routed.adapter.chat({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `请评估孩子的${DIMENSION_LABELS[dimension]}。` },
      ],
    });

    if (!response) throw new Error("No AI response");

    let json = response.trim();
    const match = json.match(/```json?\n?([\s\S]*?)```/);
    if (match) json = match[1].trim();

    const result = JSON.parse(json);

    // Validate evidence array
    if (!Array.isArray(result.evidence)) result.evidence = [];
    result.evidence = result.evidence.slice(0, 5); // max 5 evidence items

    const score = result.score;
    if (!Number.isFinite(score)) {
      console.error(
        "[competency-scorer] Malformed AI score for dimension",
        dimension,
        ":",
        score
      );
      return null;
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      summary: String(result.summary || "").slice(0, 80),
      evidence: result.evidence,
    };
  } catch {
    return { score: 50, summary: "数据不足，继续加油！", evidence: [] };
  }
}

// ── Main snapshot generator ──────────────────────────────────────

const AI_DIMENSIONS: CompetencyDimension[] = [
  "clarification",
  "decomposition",
  "reflection",
  "creativity",
];

export async function generateSnapshot(
  weekStart: string
): Promise<CompetencySnapshot[]> {
  const results: CompetencySnapshot[] = [];

  // Rule-engine scores
  const executionScore = computeExecutionScore(weekStart);
  results.push(
    upsertSnapshot(weekStart, "execution", executionScore, "rule", JSON.stringify([
      { source_table: "tasks", source_id: "", quote: "任务完成率 ×60 + 打卡率 ×40", weight: "high" },
    ]))
  );

  const persistenceScore = computePersistenceScore(weekStart);
  results.push(
    upsertSnapshot(weekStart, "persistence", persistenceScore, "rule", JSON.stringify([
      { source_table: "check_ins", source_id: "", quote: "持续天数分 + 恢复分", weight: "high" },
    ]))
  );

  // AI qualitative scores
  const weekEvents = getWeekEvents(weekStart);

  for (const dim of AI_DIMENSIONS) {
    const dimEvents = weekEvents.filter(e => e.dimension === dim);
    const evaluated = await evaluateWithAI(dim, dimEvents);
    if (evaluated === null) {
      // Malformed AI score — fall back to a neutral snapshot so the dimension
      // is not dropped and no partial/NaN data is persisted.
      results.push(
        upsertSnapshot(weekStart, dim, 50, "ai", JSON.stringify([]))
      );
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- summary reserved for future UX; snapshots store evidence only
    const { score, summary, evidence } = evaluated;
    results.push(
      upsertSnapshot(weekStart, dim, score, "ai", JSON.stringify(evidence))
    );
  }

  return results;
}
