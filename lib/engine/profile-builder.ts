import type { ChildProfile, CompetencySnapshot, EmotionLog } from "@/lib/utils/types";
import type { Message } from "@/lib/utils/types";
import { getDb } from "@/lib/db/index";

// ── 能力映射 ──────────────────────────────────
// competency_snapshots 的 6 维 → child_profile 的 5 维
const ABILITY_MAP: Record<string, keyof Abilities> = {
  creativity: "ability_creativity",
  clarification: "ability_expression",
  decomposition: "ability_logical",
  execution: "ability_focus",
  persistence: "ability_focus",
  reflection: "ability_expression",
};

interface Abilities {
  ability_creativity: number;
  ability_logical: number;
  ability_focus: number;
  ability_expression: number;
  ability_curiosity: number;
}

function scaleScore(score100: number): number {
  return Math.round(score100) / 100; // 0-100 → 0.0-1.0
}

export function computeAbilities(
  snapshots: CompetencySnapshot[]
): Abilities {
  const result: Abilities = {
    ability_creativity: 0.5,
    ability_logical: 0.5,
    ability_focus: 0.5,
    ability_expression: 0.5,
    ability_curiosity: 0.5,
  };

  // 每个目标维度的快照分数列表
  const buckets: Record<keyof Abilities, number[]> = {
    ability_creativity: [],
    ability_logical: [],
    ability_focus: [],
    ability_expression: [],
    ability_curiosity: [],
  };

  for (const snap of snapshots) {
    const target = ABILITY_MAP[snap.dimension];
    if (target && snap.score > 0) {
      buckets[target].push(scaleScore(snap.score));
    }
  }

  for (const [key, scores] of Object.entries(buckets)) {
    if (scores.length > 0) {
      result[key as keyof Abilities] =
        scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }

  return result;
}

// ── 情绪基线 ──────────────────────────────────
export function computeEmotionBaseline(
  emotions: EmotionLog[]
): Record<string, number> {
  if (emotions.length < 10) return {};
  const counts: Record<string, number> = {};
  for (const e of emotions) {
    counts[e.emotion] = (counts[e.emotion] || 0) + 1;
  }
  const baseline: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    baseline[key] = Math.round((count / emotions.length) * 100) / 100;
  }
  return baseline;
}

// ── 兴趣提取 ──────────────────────────────────
const INTEREST_KEYWORDS: Record<string, string[]> = {
  "绘画": ["画", "颜色", "涂", "描", "彩笔", "颜料", "彩铅", "手绘"],
  "恐龙": ["恐龙", "霸王龙", "三角龙", "化石", "侏罗纪"],
  "太空": ["太空", "星球", "火箭", "宇航员", "火星", "月球", "太阳系"],
  "音乐": ["音乐", "歌", "琴", "唱", "节奏", "音符", "乐器"],
  "编程": ["代码", "编程", "程序", "scratch", "python", "机器人"],
  "动物": ["动物", "猫", "狗", "鱼", "鸟", "兔子", "宠物"],
  "运动": ["球", "跑", "跳", "游泳", "运动", "比赛"],
  "故事": ["故事", "童话", "公主", "骑士", "魔法", "冒险"],
  "科学": ["实验", "科学", "为什么", "怎么", "原理", "发明"],
  "积木": ["积木", "lego", "乐高", "搭建", "拼装", "模型"],
  "数学": ["数学", "数字", "计算", "几何", "加减"],
  "自然": ["植物", "花", "树", "太阳", "雨", "雪", "风", "云", "山", "海"],
};

export function extractInterestTags(
  messages: Message[]
): string[] {
  const childMsgs = messages.filter(m => m.role === "child");
  const allText = childMsgs.map(m => m.content).join(" ").toLowerCase();
  const scores: Record<string, number> = {};
  for (const [tag, keywords] of Object.entries(INTEREST_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const count = allText.split(kw.toLowerCase()).length - 1;
      score += count;
    }
    if (score > 0) scores[tag] = score;
  }
  // 返回 top 5，按分数降序
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);
}

// ── 参与度趋势 ────────────────────────────────
export function computeEngagementTrend(
  profile: ChildProfile
): "rising" | "stable" | "declining" {
  if (profile.total_sessions < 10) return "stable";
  const db = getDb();
  const recentEmotions = db.prepare(`
    SELECT emotion FROM emotion_log
    ORDER BY created_at DESC LIMIT 30
  `).all() as { emotion: string }[];

  if (recentEmotions.length < 5) return "stable";

  const negativeCount = recentEmotions.filter(
    e => e.emotion === "frustrated" || e.emotion === "confused"
  ).length;
  const ratio = negativeCount / recentEmotions.length;

  if (ratio > 0.4) return "declining";
  const positiveCount = recentEmotions.filter(
    e => e.emotion === "excited"
  ).length;
  if (positiveCount / recentEmotions.length > 0.5) return "rising";
  return "stable";
}

// ── 提示词上下文 ──────────────────────────────
function bar(value: number): string {
  if (value >= 0.8) return "▅▅▅";
  if (value >= 0.6) return "▃▃▃";
  if (value >= 0.4) return "▂▂▂";
  return "▁▁▁";
}

export function buildProfileContext(profile: ChildProfile): string {
  const ab = [
    `创造力${bar(profile.ability_creativity)}`,
    `逻辑力${bar(profile.ability_logical)}`,
    `专注力${bar(profile.ability_focus)}`,
    `表达力${bar(profile.ability_expression)}`,
    `好奇心${bar(profile.ability_curiosity)}`,
  ].join("  ");

  const interests = JSON.parse(profile.interest_tags || "[]") as string[];
  const interestLine = interests.length > 0
    ? `当前兴趣方向：${interests.join("、")}。如果对话涉及这些领域，多延伸提问。`
    : "";

  const trendMap: Record<string, string> = {
    rising: "近期互动积极，孩子参与度在上升。可以适当提高挑战。",
    stable: "近期互动平稳。保持正常引导节奏。",
    declining: "近期互动有下降趋势。请切换轻松话题，减少任务密度，多鼓励。",
  };
  const trendLine = trendMap[profile.engagement_trend] || trendMap.stable;

  const focusLine = (profile.avg_session_minutes && profile.avg_session_minutes < 3)
    ? "孩子平均专注时长较短（<3分钟），请加快引导节奏，减少单次信息量。"
    : "";

  const parts = [
    "【孩子当前画像】",
    `能力：${ab}`,
    interestLine,
    trendLine,
    focusLine,
  ].filter(Boolean);

  return parts.join("\n");
}

// ── 深度分析 ──────────────────────────────────
const RECENT_SNAPSHOT_COUNT = 20;
const RECENT_EMOTION_COUNT = 50;
const RECENT_MESSAGE_COUNT = 100;

export function runDeepAnalysisSync(
  profile: ChildProfile
): Partial<ChildProfile> {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

  // 能力重新计算
  const snapshots = db.prepare(`
    SELECT * FROM competency_snapshots
    ORDER BY week_start DESC LIMIT ?
  `).all(RECENT_SNAPSHOT_COUNT) as CompetencySnapshot[];
  const abilities = computeAbilities(snapshots);

  // 情绪基线
  const emotions = db.prepare(`
    SELECT * FROM emotion_log
    ORDER BY created_at DESC LIMIT ?
  `).all(RECENT_EMOTION_COUNT) as EmotionLog[];
  const emotionBaseline = computeEmotionBaseline(emotions);

  // 兴趣标签
  const messages = db.prepare(`
    SELECT * FROM messages
    ORDER BY created_at DESC LIMIT ?
  `).all(RECENT_MESSAGE_COUNT) as Message[];
  const interestTags = extractInterestTags(messages);

  // 参与度趋势
  const engagementTrend = computeEngagementTrend(profile);

  return {
    ...abilities,
    ability_updated_at: now,
    emotion_baseline: JSON.stringify(emotionBaseline),
    emotion_updated_at: Object.keys(emotionBaseline).length > 0 ? now : profile.emotion_updated_at,
    interest_tags: JSON.stringify(interestTags),
    interest_updated_at: interestTags.length > 0 ? now : profile.interest_updated_at,
    engagement_trend: engagementTrend,
    deep_analysis_at: now,
  };
}
