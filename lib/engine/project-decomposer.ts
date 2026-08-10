import type { AgeGroup, SolutionPack } from "@/lib/utils/types";
import { getDb } from "@/lib/db/index";
import { routeModel } from "@/lib/models/router";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";

export interface DecomposedTrack {
  name: string;
  type: "software" | "diy";
  milestones: DecomposedMilestone[];
}

export interface DecomposedMilestone {
  title: string;
  tasks: DecomposedTask[];
}

export interface DecomposedTask {
  title: string;
  what_to_do: string;
  how_hint: string;
  difficulty: number; // 1-3
}

export interface DecomposedProject {
  tracks: DecomposedTrack[];
}

// Keyword-based track classification
const SOFTWARE_KEYWORDS = ["代码", "编程", "arduino", "网页", "app", "游戏", "python", "scratch", "javascript", "程序", "算法", "网站", "micro:bit", "传感器读取"];
const DIY_KEYWORDS = ["材料", "搭建", "组装", "焊接", "测量", "画图", "切割", "木板", "纸板", "3d打印", "乐高", "积木", "胶水", "剪刀", "连接水管", "防水"];

function classifyTrackType(stepTitle: string, stepWhatToDo: string): "software" | "diy" {
  const text = (stepTitle + stepWhatToDo).toLowerCase();
  const swScore = SOFTWARE_KEYWORDS.filter(k => text.includes(k.toLowerCase())).length;
  const diyScore = DIY_KEYWORDS.filter(k => text.includes(k.toLowerCase())).length;
  return swScore >= diyScore ? "software" : "diy";
}

export async function decomposeSolutionPack(
  sessionId: string,
  ageGroup: AgeGroup
): Promise<DecomposedProject | null> {
  const packs = getSolutionPacks(sessionId);
  if (packs.length === 0) return null;

  const pack: SolutionPack = packs[0]; // latest version first
  const maxTasksPerMilestone = ageGroup === "6-9" ? 2 : ageGroup === "10-12" ? 4 : 5;

  const routed = routeModel("dialogue");
  if (!routed) return null;

  const decomposePrompt = `${buildSystemPrompt(ageGroup, 5)}

## 任务：拆解项目方案包

请把下面的方案包拆解为可执行的项目结构。

### 方案包内容
${pack.content}

### 拆解规则
1. 根据内容自动识别轨道类型（software 编程类 / diy 手工类），可有多条轨道
2. 每条轨道下拆分里程碑（milestone），每个里程碑下面拆分具体任务
3. 每个里程碑最多 ${maxTasksPerMilestone} 个任务
4. 任务难度分布：~30% 难度1，~50% 难度2，~20% 难度3
5. how_hint 给线索不给答案，如"提示：想想 if 语句怎么判断湿度是否太高"
6. 名字要好玩的、孩子能懂的

### 输出格式（只输出 JSON）
{
  "tracks": [
    {
      "name": "轨道名称",
      "type": "software",
      "milestones": [
        {
          "title": "里程碑名称",
          "tasks": [
            { "title": "任务名", "what_to_do": "做什么", "how_hint": "小提示", "difficulty": 1 }
          ]
        }
      ]
    }
  ]
}`;

  try {
    const response = await routed.adapter.chat({
      messages: [
        { role: "system", content: decomposePrompt },
        { role: "user", content: "请拆解这个方案包。" },
      ],
    });

    if (!response) return null;

    // Extract JSON
    let json = response;
    const match = json.match(/```json?\n?([\s\S]*?)```/);
    if (match) json = match[1].trim();
    json = json.trim();

    const result: DecomposedProject = JSON.parse(json);

    // Fallback classification for any track without explicit type
    for (const track of result.tracks) {
      if (!track.type || !["software", "diy"].includes(track.type)) {
        // Classify based on first task content
        const firstTask = track.milestones[0]?.tasks[0];
        track.type = firstTask
          ? classifyTrackType(firstTask.title, firstTask.what_to_do)
          : "software";
      }
    }

    return result;
  } catch {
    return null;
  }
}

// Helper: get latest solution pack for a session
function getSolutionPacks(sessionId: string): SolutionPack[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM solution_packs WHERE session_id = ? ORDER BY version DESC"
  ).all(sessionId) as SolutionPack[];
}
