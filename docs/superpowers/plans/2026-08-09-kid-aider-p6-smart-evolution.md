# P6 智能进化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建自适应策略引擎——利用 P1-P5 积累的对话记录、情绪日志、能力评分、项目历史，动态调整"小K"的引导策略，让系统随孩子的成长而进化。

**Architecture:** 新增 child_profile 聚合表存储六维画像（5 能力维度 + 兴趣 + 情绪基线 + 交互模式），profile_updates 日志表追踪每次变更。两级更新：session_start 时 O(1) 读取画像注入 prompt（阻塞但 <5ms），session_end 时 fire-and-forget 轻量更新计数，deep_analysis 后台异步全量重新计算。画像对孩子不可见——仅通过 prompt builder 注入策略上下文。

**Tech Stack:** Next.js 14 + TypeScript strict + better-sqlite3 + Tailwind CSS v3（零新增依赖）

## Global Constraints

- **零新增 npm 依赖** — 计算逻辑纯 TypeScript，无外部库
- **不改变现有 SSE 架构** — 画像读取是 O(1) DB 查询，在 prompt 构建前完成
- **TypeScript strict，无 `any` 跳过**
- **遵循项目 token 设计系统**（text-ink-tertiary, bg-surface, border-border, rounded-card, rounded-btn）
- **异步分析不阻塞用户交互** — 深度分析用 setTimeout(0) fire-and-forget
- **画像数据仅影响提示词策略，不改变现有数据流** — 删除画像表后系统回退到 P5 行为

---

### Task 1: 类型定义与数据库扩展

**Files:**
- Modify: `lib/utils/types.ts` — 追加 ChildProfile、ProfileUpdate 接口
- Modify: `lib/db/index.ts` — 追加 child_profile、profile_updates 建表语句

**Interfaces:**
- Produces: `ChildProfile` 类型, `ProfileUpdate` 类型
- Produces: `child_profile`, `profile_updates` 表

- [ ] **Step 1: 添加 TypeScript 类型**

在 `lib/utils/types.ts` 文件末尾添加：

```typescript
export interface ChildProfile {
  id: string;
  ability_creativity: number;   // 0.0-1.0
  ability_logical: number;
  ability_focus: number;
  ability_expression: number;
  ability_curiosity: number;
  ability_updated_at: string | null;
  interest_tags: string;        // JSON array: ["绘画","恐龙"]
  interest_updated_at: string | null;
  emotion_baseline: string;     // JSON: {"excited":0.3,"calm":0.4,...}
  emotion_updated_at: string | null;
  preferred_time_range: string | null;
  avg_session_minutes: number | null;
  engagement_trend: string;     // "rising" | "stable" | "declining"
  total_sessions: number;
  last_session_at: string | null;
  deep_analysis_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  id: string;
  trigger: "session_start" | "session_end" | "deep_analysis";
  changes: string;   // JSON: 记录哪些字段发生了变化
  snapshot: string | null;  // JSON: 变更后的画像快照
  created_at: string;
}
```

- [ ] **Step 2: 添加建表语句**

在 `lib/db/index.ts` 的 `db.exec()` 中，找到 `emotion_log` 建表语句和 `idx_emotion_log_session` 索引之后，追加：

```sql
CREATE TABLE IF NOT EXISTS child_profile (
  id                TEXT PRIMARY KEY,
  ability_creativity    REAL DEFAULT 0.5,
  ability_logical       REAL DEFAULT 0.5,
  ability_focus         REAL DEFAULT 0.5,
  ability_expression    REAL DEFAULT 0.5,
  ability_curiosity     REAL DEFAULT 0.5,
  ability_updated_at    TEXT,
  interest_tags         TEXT DEFAULT '[]',
  interest_updated_at   TEXT,
  emotion_baseline      TEXT DEFAULT '{}',
  emotion_updated_at    TEXT,
  preferred_time_range  TEXT,
  avg_session_minutes   REAL,
  engagement_trend      TEXT DEFAULT 'stable',
  total_sessions        INTEGER DEFAULT 0,
  last_session_at       TEXT,
  deep_analysis_at      TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_updates (
  id            TEXT PRIMARY KEY,
  trigger       TEXT NOT NULL CHECK(trigger IN ('session_start', 'session_end', 'deep_analysis')),
  changes       TEXT NOT NULL,
  snapshot      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add lib/utils/types.ts lib/db/index.ts
git commit -m "feat(p6): add ChildProfile and ProfileUpdate types, create tables"
```

---

### Task 2: 数据库 CRUD 模块

**Files:**
- Create: `lib/db/child-profile.ts`

**Interfaces:**
- Consumes: `ChildProfile` 类型, `ProfileUpdate` 类型
- Produces:
  - `getOrCreateChildProfile(): ChildProfile` — 幂等获取或创建画像
  - `getChildProfile(): ChildProfile | null`
  - `updateChildProfile(id: string, fields: Partial<...>): void`
  - `createProfileUpdate(attrs: ...): ProfileUpdate`

- [ ] **Step 1: 创建 CRUD 模块**

创建 `lib/db/child-profile.ts`：

```typescript
import { getDb } from "./index";
import type { ChildProfile, ProfileUpdate } from "@/lib/utils/types";
import { v4 as uuid } from "uuid";

const DEFAULT_ID = "default";

export function getOrCreateChildProfile(): ChildProfile {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

  const existing = db.prepare("SELECT * FROM child_profile WHERE id = ?").get(DEFAULT_ID) as ChildProfile | undefined;
  if (existing) return existing;

  db.prepare(`
    INSERT INTO child_profile (id, created_at, updated_at)
    VALUES (?, ?, ?)
  `).run(DEFAULT_ID, now, now);

  return db.prepare("SELECT * FROM child_profile WHERE id = ?").get(DEFAULT_ID) as ChildProfile;
}

export function getChildProfile(): ChildProfile | null {
  const db = getDb();
  return db.prepare("SELECT * FROM child_profile WHERE id = ?")
    .get(DEFAULT_ID) as ChildProfile | null;
}

export function updateChildProfile(
  id: string,
  fields: Partial<Omit<ChildProfile, "id" | "created_at" | "updated_at">>
): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(", ");
  const values = keys.map(k => (fields as Record<string, unknown>)[k]);
  db.prepare(`UPDATE child_profile SET ${setClause}, updated_at = ? WHERE id = ?`)
    .run(...values, now, id);
}

export function createProfileUpdate(attrs: {
  trigger: "session_start" | "session_end" | "deep_analysis";
  changes: Record<string, unknown>;
  snapshot?: Partial<ChildProfile> | null;
}): ProfileUpdate {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare(`
    INSERT INTO profile_updates (id, trigger, changes, snapshot, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, attrs.trigger, JSON.stringify(attrs.changes), attrs.snapshot ? JSON.stringify(attrs.snapshot) : null, now);
  return {
    id, trigger: attrs.trigger,
    changes: JSON.stringify(attrs.changes),
    snapshot: attrs.snapshot ? JSON.stringify(attrs.snapshot) : null,
    created_at: now,
  };
}
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/child-profile.ts
git commit -m "feat(p6): add child profile CRUD module"
```

---

### Task 3: 画像计算引擎

**Files:**
- Create: `lib/engine/profile-builder.ts`

**Interfaces:**
- Consumes: `ChildProfile`, `CompetencySnapshot`, `EmotionLog`, `Message`
- Produces:
  - `computeAbilities(snapshots: CompetencySnapshot[]): { ability_creativity: number, ... }`
  - `computeEmotionBaseline(emotions: EmotionLog[]): Record<string, number>`
  - `extractInterestTags(messages: Message[]): string[]`
  - `computeEngagementTrend(profile: ChildProfile): "rising" | "stable" | "declining"`
  - `buildProfileContext(profile: ChildProfile): string`
  - `runDeepAnalysis(): Promise<Partial<ChildProfile>>`

- [ ] **Step 1: 创建画像计算引擎**

创建 `lib/engine/profile-builder.ts`：

```typescript
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
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add lib/engine/profile-builder.ts
git commit -m "feat(p6): add profile builder engine with ability, emotion, interest, and trend computation"
```

---

### Task 4: API 路由

**Files:**
- Create: `app/api/profile/route.ts`
- Create: `app/api/profile/analyze/route.ts`

**Interfaces:**
- Consumes: `getOrCreateChildProfile()`, `getChildProfile()`, `updateChildProfile()`, `createProfileUpdate()`, `runDeepAnalysisSync()`
- Produces: GET `{ profile, lastDeepAnalysis }`, POST `{ status: "started" | "skipped" }`

- [ ] **Step 1: 创建 GET /api/profile**

创建 `app/api/profile/route.ts`：

```typescript
import { getOrCreateChildProfile, getChildProfile } from "@/lib/db/child-profile";

export async function GET() {
  const profile = getChildProfile();
  if (!profile) {
    // 首次访问，创建默认画像
    const newProfile = getOrCreateChildProfile();
    return Response.json({ profile: newProfile, lastDeepAnalysis: null });
  }
  return Response.json({
    profile,
    lastDeepAnalysis: profile.deep_analysis_at,
  });
}
```

- [ ] **Step 2: 创建 POST /api/profile/analyze**

创建 `app/api/profile/analyze/route.ts`：

```typescript
import { getOrCreateChildProfile, updateChildProfile, createProfileUpdate } from "@/lib/db/child-profile";
import { runDeepAnalysisSync } from "@/lib/engine/profile-builder";

const MIN_ANALYSIS_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 小时

export async function POST() {
  const profile = getOrCreateChildProfile();

  // 冷却检查
  if (profile.deep_analysis_at) {
    const lastTime = new Date(profile.deep_analysis_at).getTime();
    if (Date.now() - lastTime < MIN_ANALYSIS_INTERVAL_MS) {
      return Response.json({ status: "skipped", reason: "分析间隔不足 6 小时" });
    }
  }

  // 异步分析，立返
  setTimeout(() => {
    try {
      const updates = runDeepAnalysisSync(profile);
      updateChildProfile(profile.id, updates);
      createProfileUpdate({
        trigger: "deep_analysis",
        changes: Object.keys(updates).reduce((acc, k) => {
          acc[k] = (updates as Record<string, unknown>)[k];
          return acc;
        }, {} as Record<string, unknown>),
        snapshot: { ...profile, ...updates },
      });
    } catch (err) {
      console.error("[profile] deep analysis failed:", err);
    }
  }, 0);

  return Response.json({ status: "started" });
}
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/profile/route.ts app/api/profile/analyze/route.ts
git commit -m "feat(p6): add profile API routes (GET + POST analyze)"
```

---

### Task 5: Chat API 集成画像注入

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `lib/engine/prompt-builder.ts`

**Interfaces:**
- Consumes: `getOrCreateChildProfile()`, `updateChildProfile()`, `buildProfileContext()`
- Produces: 画像感知的聊天流

- [ ] **Step 1: 修改 prompt-builder.ts**

在 `lib/engine/prompt-builder.ts` 中，修改 `buildChatPrompt` 函数签名，新增 `profileContext?: string` 参数，在 system prompt 后、历史消息前注入画像上下文：

```typescript
export function buildChatPrompt(opts: {
  ageGroup: AgeGroup;
  funnelStep: number;
  funnelState?: FunnelState;
  recentMessages: Message[];
  currentInput: string;
  profileContext?: string;  // ← 新增
}): ChatMessage[] {
  const systemPrompt = buildSystemPrompt(opts.ageGroup, opts.funnelStep);
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // 注入画像上下文（在情绪上下文之前）
  if (opts.profileContext) {
    messages.push({ role: "system", content: opts.profileContext });
  }

  // ... 其余不变
```

- [ ] **Step 2: 修改 chat route**

在 `app/api/chat/route.ts` 中：

a) 添加 import：

```typescript
import { getOrCreateChildProfile, updateChildProfile, createProfileUpdate } from "@/lib/db/child-profile";
import { buildProfileContext } from "@/lib/engine/profile-builder";
```

b) 在 `buildChatPrompt` 调用前（约 line 129，`// Build prompt` 注释附近），添加画像读取：

```typescript
// Build prompt
const recentMessages = getRecentMessages(session.id, 20);

// --- P6 profile injection ---
const profile = getOrCreateChildProfile();
const profileContext = buildProfileContext(profile);
// --- End P6 profile injection ---
```

c) 修改 buildChatPrompt 调用，传入 profileContext：

```typescript
let promptMessages = buildChatPrompt({
  ageGroup: ag,
  funnelStep: session.funnel_step,
  funnelState,
  recentMessages,
  currentInput: message,
  profileContext,  // ← 新增
});
```

d) 在 SSE 流结束后（约 line 314，`controller.enqueue(encoder.encode("data: [DONE]\n\n"))` 前），添加 session_end 轻量更新：

```typescript
// P6 session-end lightweight update (fire-and-forget)
const messagesThisSession = recentMessages.filter(m => m.role === "child").length + 1;
if (streamOk && messagesThisSession >= 3) {
  setTimeout(() => {
    try {
      const p = getOrCreateChildProfile();
      updateChildProfile(p.id, {
        total_sessions: p.total_sessions + 1,
        last_session_at: new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, ""),
      });
      createProfileUpdate({
        trigger: "session_end",
        changes: { total_sessions: p.total_sessions + 1 },
      });
    } catch (err) {
      console.warn("[chat] profile session-end update failed:", err);
    }
  }, 0);
}
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

预期：零错误，SSE 架构不变，画像注入不影响现有聊天流。

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts lib/engine/prompt-builder.ts
git commit -m "feat(p6): inject child profile context into chat prompt, add session-end lightweight updates"
```

---

### Task 6: 家长面板画像视图

**Files:**
- Create: `components/parent/profile-view.tsx`
- Modify: `app/parent/page.tsx` — 新增"能力画像" Tab

**Interfaces:**
- Consumes: `/api/profile` GET
- Produces: 可视化的画像卡片

- [ ] **Step 1: 创建画像视图组件**

创建 `components/parent/profile-view.tsx`：

```tsx
"use client";

import { useEffect, useState } from "react";
import { RadarChart } from "@/components/growth/radar-chart";
import type { ChildProfile } from "@/lib/utils/types";

export function ProfileView() {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const res = await fetch("/api/profile/analyze", { method: "POST" });
    const d = await res.json();
    setAnalyzing(false);
    // Refresh
    const refresh = await fetch("/api/profile");
    const rd = await refresh.json();
    setProfile(rd.profile);
  };

  if (loading) {
    return <div className="p-6 text-ink-tertiary">加载中...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-ink-tertiary">暂无数据</div>;
  }

  const abilityData: Record<string, number> = {
    creativity: Math.round(profile.ability_creativity * 100),
    logical: Math.round(profile.ability_logical * 100),
    focus: Math.round(profile.ability_focus * 100),
    expression: Math.round(profile.ability_expression * 100),
    curiosity: Math.round(profile.ability_curiosity * 100),
  };

  const abilityLabels: Record<string, string> = {
    creativity: "创造力",
    logical: "逻辑力",
    focus: "专注力",
    expression: "表达力",
    curiosity: "好奇心",
  };

  const interests = JSON.parse(profile.interest_tags || "[]") as string[];
  const emotionBaseline = JSON.parse(profile.emotion_baseline || "{}") as Record<string, number>;

  const trendLabels: Record<string, string> = {
    rising: "📈 上升",
    stable: "➡️ 平稳",
    declining: "📉 下降",
  };

  const emotionEmoji: Record<string, string> = {
    excited: "🎉",
    calm: "😌",
    frustrated: "😟",
    impatient: "😤",
    confused: "🤔",
  };

  return (
    <div className="space-y-6">
      {/* 能力雷达图 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-4">📡 能力雷达</h2>
        <RadarChart
          data={abilityData}
          labels={abilityLabels}
          size={280}
        />
      </section>

      {/* 兴趣标签 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🏷️ 兴趣标签</h2>
        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {interests.map(tag => (
              <span key={tag} className="px-3 py-1 bg-surface-raised border border-border rounded-full text-body-sm">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-ink-tertiary text-body-sm">数据积累中，多聊聊就能发现兴趣方向</p>
        )}
      </section>

      {/* 情绪基线 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">💭 情绪分布</h2>
        {Object.keys(emotionBaseline).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(emotionBaseline).map(([emotion, ratio]) => (
              <div key={emotion} className="flex items-center gap-2">
                <span className="w-8">{emotionEmoji[emotion] || "❓"}</span>
                <div className="flex-1 h-4 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
                <span className="text-body-sm text-ink-tertiary w-10 text-right">
                  {Math.round(ratio * 100)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-tertiary text-body-sm">情绪数据积累中（需 ≥10 条记录）</p>
        )}
      </section>

      {/* 互动统计 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📊 互动统计</h2>
        <div className="grid grid-cols-2 gap-4 text-body-sm">
          <div>
            <span className="text-ink-tertiary">总对话次数</span>
            <p className="text-body-lg font-bold">{profile.total_sessions}</p>
          </div>
          <div>
            <span className="text-ink-tertiary">平均时长</span>
            <p className="text-body-lg font-bold">
              {profile.avg_session_minutes ? `${Math.round(profile.avg_session_minutes)} 分钟` : "—"}
            </p>
          </div>
          <div>
            <span className="text-ink-tertiary">最近活跃</span>
            <p className="text-body-lg font-bold">
              {profile.last_session_at
                ? new Date(profile.last_session_at).toLocaleDateString("zh-CN")
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-ink-tertiary">参与趋势</span>
            <p className="text-body-lg font-bold">{trendLabels[profile.engagement_trend] || "—"}</p>
          </div>
        </div>
      </section>

      {/* 深度分析触发 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-body-lg font-bold">🔬 深度分析</h2>
            <p className="text-body-sm text-ink-tertiary mt-1">
              {profile.deep_analysis_at
                ? `上次分析：${new Date(profile.deep_analysis_at).toLocaleString("zh-CN")}`
                : "尚未执行"}
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm disabled:opacity-40"
          >
            {analyzing ? "分析中..." : "立即分析"}
          </button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 修改 parent page 添加 Tab**

在 `app/parent/page.tsx` 中：

a) 添加 import：

```typescript
import { ProfileView } from "@/components/parent/profile-view";
```

b) 修改 `Tab` 类型定义：

```typescript
type Tab = "control" | "models" | "projects" | "profile" | "data" | "logs";
```

c) 在 tabs 数组中插入（在 "projects" 和 "data" 之间）：

```typescript
{ key: "profile", label: "画像", icon: "🧠" },
```

d) 在 JSX Tab content 区域添加（在 projects 和 data 之间）：

```tsx
{tab === "profile" && <ProfileView />}
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add components/parent/profile-view.tsx app/parent/page.tsx
git commit -m "feat(p6): add profile view with radar chart, interest tags, emotion baseline, and deep analysis trigger"
```

---

### Task 7: 集成联调与文档更新

**Files:**
- Modify: `DEVELOPMENT.md`

**Interfaces:**
- Consumes: 所有 Task 1-6 产物
- Produces: 最终版本验证

- [ ] **Step 1: Full build verification**

```bash
npm run build
```

预期：零错误，零新警告。

- [ ] **Step 2: Cross-task consistency check**

验证：
- Task 1 类型被 Task 2 CRUD + Task 3 engine + Task 6 UI 使用
- Task 2 CRUD 被 Task 4 API + Task 5 Chat 使用
- Task 3 engine 被 Task 4 API + Task 5 Chat + Task 6 UI 使用
- Task 4 API 被 Task 6 UI 调用
- Task 5 Chat 修改不影响现有 SSE 流
- Task 6 UI 正确调用 /api/profile 和 /api/profile/analyze

- [ ] **Step 3: Update DEVELOPMENT.md**

Replace progress line:

```
P1 ██████████ 100% | P2 ██████████ 100% | P3 ██████████ 100% | P4 ██████████ 100% | P5 ██████████ 100% | P6 未开始
```

with:

```
P1 ██████████ 100% | P2 ██████████ 100% | P3 ██████████ 100% | P4 ██████████ 100% | P5 ██████████ 100% | P6 ██████████ 100% | P7 未开始
```

Add P6 section (before P5):

```markdown
## P6 · 智能进化（目标：2026-08-23）
- [x] Task 1: 类型定义与数据库扩展
- [x] Task 2: 数据库 CRUD 模块
- [x] Task 3: 画像计算引擎
- [x] Task 4: API 路由
- [x] Task 5: Chat API 集成画像注入
- [x] Task 6: 家长面板画像视图
- [x] Task 7: 集成联调与文档更新
```

- [ ] **Step 4: Final commit**

```bash
git add DEVELOPMENT.md
git commit -m "feat(p6): update DEVELOPMENT.md — P6 complete"
```

---

