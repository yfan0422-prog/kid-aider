import type { AgeGroup, SolutionPack } from "@/lib/utils/types";
import { getRequirementNodes } from "@/lib/db/requirements";
import { createSolutionPack } from "@/lib/db/solution-packs";
import { routeModel } from "@/lib/models/router";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";
import { getLayerLabel } from "@/lib/engine/funnel-machine";

export async function composeSolutionPack(
  sessionId: string,
  ageGroup: AgeGroup
): Promise<SolutionPack | null> {
  const nodes = getRequirementNodes(sessionId);
  if (nodes.length === 0) return null;

  const routed = routeModel("solution_composing") || routeModel("dialogue");
  if (!routed) return null;

  // Build requirements summary
  const requirements = nodes.map(n =>
    `- ${getLayerLabel(n.layer as 1|2|3|4|5)}：${n.content}`
  ).join("\n");

  const composePrompt = `${buildSystemPrompt(ageGroup, 5)}

## 任务：生成方案包
基于孩子确认的需求，生成一份结构化的方案包。

### 孩子的需求
${requirements}

### 请按以下 YAML 格式输出方案包（只输出 YAML，不要其他内容）：

\`\`\`yaml
solution_pack:
  title: 项目名称（有趣、孩子会喜欢的名字）
  child_statement: 保留孩子的原始需求（第一人称，像孩子自己说的那样）
  requirement:
    goal: 一句话目标
    user_scenario: 使用场景
    features: [功能1, 功能2, 功能3]
    constraints: [约束]
    acceptance: 验收标准
  plan:
    steps:
      - title: 第一步名称
        what_to_do: 做什么
        how_hint: 怎么做的小提示（不给答案，给线索）
        difficulty: 1-3
    milestones: [里程碑描述]
  agent_prompt: |
    给下游智能体（如 Claude Code）的完整提示词，用中文写，
    清晰、结构化，包含所有必要信息，可以直接复制使用。
  reflection_questions:
    - 复盘问题1
    - 复盘问题2
\`\`\``;

  try {
    const response = await routed.adapter.chat({
      messages: [
        { role: "system", content: composePrompt },
        { role: "user", content: "请生成方案包。" },
      ],
    });

    if (!response) return null;

    // Extract YAML from response (strip markdown code fences if present)
    let yaml = response;
    const match = yaml.match(/```yaml?\n?([\s\S]*?)```/);
    if (match) yaml = match[1].trim();
    yaml = yaml.trim();

    // Extract title
    const titleMatch = yaml.match(/title:\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : "未命名项目";

    const pack = createSolutionPack({
      session_id: sessionId,
      title,
      content: yaml,
    });

    return pack;
  } catch {
    return null;
  }
}
