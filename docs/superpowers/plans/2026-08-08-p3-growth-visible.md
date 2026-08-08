# P3 · 成长可见 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "growth visibility" layer — six-dimension competency scoring (rule engine + AI), tiered badge system, showcase wall, and parent report with radar/trend charts.

**Architecture:** Three new SQLite tables (competency_snapshots, evidence_events, badges) feed a scoring pipeline (evidence-collector → competency-scorer → badge-evaluator). Three new pages (/growth, /showcase, /report) render SVG charts and badge displays. Evidence events are recorded by existing P1/P2 API routes at action time; scoring runs on-demand when the growth page is visited.

**Tech Stack:** Next.js 14 App Router + TypeScript strict + Tailwind CSS v3 + Zustand v5 + better-sqlite3 + pure SVG charts (no charting library)

## Global Constraints

- Zero new npm dependencies — all charts are pure SVG
- AI calls use `routeModel("dialogue")` → `adapter.chat({ temperature: 0.3 })`, non-streaming
- All DB modules follow existing pattern: `import { v4 as uuid } from "uuid"`, `import { getDb } from "./index"`, `getDb()` call inside each function
- All API routes follow Next.js App Router: `export async function GET/POST(req: NextRequest)`, `NextResponse.json(...)`
- All pages are `"use client"` with `useState`/`useEffect`
- UI components use existing shadcn/ui primitives from `@/components/ui/*`
- Age-tiered copy: 6-9 uses emoji + short sentences; 10-12 friendly but rational; 13-15 near-adult coach tone
- AI qualitative scores MUST include evidence array with verbatim `quote`, `source` (table.field), and `weight` (high/medium/low)
- Score range: 0-100 for all six dimensions
- Badge conditions: silver = ≥60 score sustained 2 weeks; gold = ≥80 score sustained 4 weeks
- Showcase featured projects stored in localStorage, max 2
- PDF export via `window.print()`, zero server-side PDF deps

---

### Task 1: P3 类型与数据库扩展

**Files:**
- Modify: `lib/utils/types.ts`
- Modify: `lib/db/index.ts`

**Interfaces:**
- Produces: `CompetencyDimension`, `ScoreType`, `BadgeTier`, `BadgeCategory`, `CompetencySnapshot`, `EvidenceEvent`, `Badge`

- [ ] **Step 1: Add P3 types to types.ts**

Append after the existing `ProjectLog` interface in `lib/utils/types.ts`:

```typescript
export type CompetencyDimension =
  | "clarification"
  | "decomposition"
  | "execution"
  | "reflection"
  | "creativity"
  | "persistence";

export type ScoreType = "rule" | "ai";

export type BadgeTier = "silver" | "gold";

export type BadgeCategory = "competency" | "achievement";

export interface CompetencySnapshot {
  id: string;
  week_start: string; // YYYY-MM-DD Monday
  dimension: CompetencyDimension;
  score: number; // 0-100
  score_type: ScoreType;
  evidence: string; // JSON array of {source_table, source_id, quote, weight}
  created_at: string;
}

export interface EvidenceEvent {
  id: string;
  dimension: CompetencyDimension;
  event_type: string;
  source_table: string;
  source_id: string;
  payload: string; // JSON object
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  label: string;
  tier: BadgeTier;
  dimension: CompetencyDimension | null;
  category: BadgeCategory;
  description: string;
  icon: string;
  earned_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Add 3 tables + indexes to lib/db/index.ts**

Insert into the `db.exec(` block, after the existing P2 tables and before the closing backtick:

```sql
CREATE TABLE IF NOT EXISTS competency_snapshots (
  id          TEXT PRIMARY KEY,
  week_start  TEXT NOT NULL,
  dimension   TEXT NOT NULL CHECK(dimension IN (
                'clarification','decomposition','execution',
                'reflection','creativity','persistence'
              )),
  score       INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  score_type  TEXT NOT NULL CHECK(score_type IN ('rule','ai')),
  evidence    TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  UNIQUE(week_start, dimension)
);

CREATE TABLE IF NOT EXISTS evidence_events (
  id           TEXT PRIMARY KEY,
  dimension    TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  payload      TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS badges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  label       TEXT NOT NULL,
  tier        TEXT NOT NULL CHECK(tier IN ('silver','gold')),
  dimension   TEXT,
  category    TEXT NOT NULL CHECK(category IN ('competency','achievement')),
  description TEXT NOT NULL,
  icon        TEXT NOT NULL,
  earned_at   TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_week ON competency_snapshots(week_start);
CREATE INDEX IF NOT EXISTS idx_evidence_dimension ON evidence_events(dimension);
CREATE INDEX IF NOT EXISTS idx_evidence_created ON evidence_events(created_at);
CREATE INDEX IF NOT EXISTS idx_badges_dimension ON badges(dimension);
CREATE INDEX IF NOT EXISTS idx_badges_earned ON badges(earned_at);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/types.ts lib/db/index.ts
git commit -m "feat(p3): add competency/badge/evidence types and DB tables"
```

---

### Task 2: 证据事件采集器

**Files:**
- Create: `lib/engine/evidence-collector.ts`

**Interfaces:**
- Produces: `recordEvent(dimension: CompetencyDimension, eventType: string, sourceTable: string, sourceId: string, payload?: Record<string, unknown>): EvidenceEvent`

- [ ] **Step 1: Create evidence-collector.ts**

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db/index";
import type { CompetencyDimension, EvidenceEvent } from "@/lib/utils/types";

export function recordEvent(
  dimension: CompetencyDimension,
  eventType: string,
  sourceTable: string,
  sourceId: string,
  payload?: Record<string, unknown>
): EvidenceEvent {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const payloadJson = JSON.stringify(payload || {});

  db.prepare(
    `INSERT INTO evidence_events (id, dimension, event_type, source_table, source_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, dimension, eventType, sourceTable, sourceId, payloadJson, now);

  return {
    id,
    dimension,
    event_type: eventType,
    source_table: sourceTable,
    source_id: sourceId,
    payload: payloadJson,
    created_at: now,
  };
}

export function getEventsForWeek(
  weekStart: string,
  dimension?: CompetencyDimension
): EvidenceEvent[] {
  const db = getDb();
  const weekEnd = new Date(
    new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  if (dimension) {
    return db.prepare(
      `SELECT * FROM evidence_events
       WHERE dimension = ? AND created_at >= ? AND created_at < ?
       ORDER BY created_at ASC`
    ).all(dimension, weekStart, weekEnd) as EvidenceEvent[];
  }

  return db.prepare(
    `SELECT * FROM evidence_events
     WHERE created_at >= ? AND created_at < ?
     ORDER BY created_at ASC`
  ).all(weekStart, weekEnd) as EvidenceEvent[];
}

/** Get this week's Monday as YYYY-MM-DD */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 1
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add lib/engine/evidence-collector.ts
git commit -m "feat(p3): add evidence event collector"
```

---

### Task 3: 数据库 CRUD 模块

**Files:**
- Create: `lib/db/competency-snapshots.ts`
- Create: `lib/db/evidence-events.ts`
- Create: `lib/db/badges.ts`

**Interfaces:**
- Consumes: `CompetencySnapshot`, `EvidenceEvent`, `Badge` types from Task 1
- Produces: `upsertSnapshot`, `getLatestSnapshots`, `getSnapshotsByRange`, `getEventsByDimension`, `getWeekEvents`, `getAllBadges`, `getEarnedBadges`, `updateBadgeEarned`, `initBadges`

- [ ] **Step 1: Create lib/db/competency-snapshots.ts**

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { CompetencyDimension, CompetencySnapshot } from "@/lib/utils/types";

export function upsertSnapshot(
  weekStart: string,
  dimension: CompetencyDimension,
  score: number,
  scoreType: "rule" | "ai",
  evidence: string
): CompetencySnapshot {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.prepare(
    "SELECT id FROM competency_snapshots WHERE week_start = ? AND dimension = ?"
  ).get(weekStart, dimension) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE competency_snapshots SET score = ?, score_type = ?, evidence = ?, created_at = ?
       WHERE id = ?`
    ).run(score, scoreType, evidence, now, existing.id);
    return db.prepare(
      "SELECT * FROM competency_snapshots WHERE id = ?"
    ).get(existing.id) as CompetencySnapshot;
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO competency_snapshots (id, week_start, dimension, score, score_type, evidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, weekStart, dimension, score, scoreType, evidence, now);

  return db.prepare(
    "SELECT * FROM competency_snapshots WHERE id = ?"
  ).get(id) as CompetencySnapshot;
}

export function getLatestSnapshots(): CompetencySnapshot[] {
  const db = getDb();
  return db.prepare(
    `SELECT cs.* FROM competency_snapshots cs
     JOIN (SELECT dimension, MAX(week_start) as max_week
           FROM competency_snapshots GROUP BY dimension) latest
     ON cs.dimension = latest.dimension AND cs.week_start = latest.max_week`
  ).all() as CompetencySnapshot[];
}

export function getSnapshotsByRange(
  startWeek: string,
  endWeek: string
): CompetencySnapshot[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM competency_snapshots
     WHERE week_start >= ? AND week_start <= ?
     ORDER BY week_start ASC, dimension ASC`
  ).all(startWeek, endWeek) as CompetencySnapshot[];
}
```

- [ ] **Step 2: Create lib/db/evidence-events.ts**

```typescript
import { getDb } from "./index";
import type { CompetencyDimension, EvidenceEvent } from "@/lib/utils/types";

export function getEventsByDimension(
  dimension: CompetencyDimension,
  since: string
): EvidenceEvent[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM evidence_events
     WHERE dimension = ? AND created_at >= ?
     ORDER BY created_at ASC`
  ).all(dimension, since) as EvidenceEvent[];
}

export function getWeekEvents(weekStart: string): EvidenceEvent[] {
  const db = getDb();
  const weekEnd = new Date(
    new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  return db.prepare(
    `SELECT * FROM evidence_events
     WHERE created_at >= ? AND created_at < ?
     ORDER BY created_at ASC`
  ).all(weekStart, weekEnd) as EvidenceEvent[];
}

export function hasWeekEvents(weekStart: string): boolean {
  const db = getDb();
  const weekEnd = new Date(
    new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  const row = db.prepare(
    "SELECT COUNT(*) as count FROM evidence_events WHERE created_at >= ? AND created_at < ?"
  ).get(weekStart, weekEnd) as { count: number };
  return row.count > 0;
}
```

- [ ] **Step 3: Create lib/db/badges.ts**

```typescript
import { getDb } from "./index";
import type { Badge } from "@/lib/utils/types";

export function getAllBadges(): Badge[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM badges ORDER BY category, dimension, tier"
  ).all() as Badge[];
}

export function getEarnedBadges(): Badge[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM badges WHERE earned_at IS NOT NULL ORDER BY earned_at DESC"
  ).all() as Badge[];
}

export function getUnearnedBadges(): Badge[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM badges WHERE earned_at IS NULL ORDER BY category, dimension, tier"
  ).all() as Badge[];
}

export function markBadgeEarned(id: string): Badge | undefined {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE badges SET earned_at = ? WHERE id = ?").run(now, id);
  return db.prepare("SELECT * FROM badges WHERE id = ?").get(id) as Badge | undefined;
}

/** Initialize 15 badge definitions. Safe to call multiple times — skips existing. */
export function initBadges(): void {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as count FROM badges").get() as { count: number };
  if (count.count > 0) return;

  const now = new Date().toISOString();
  const badges: Array<{
    id: string;
    name: string;
    label: string;
    tier: string;
    dimension: string | null;
    category: string;
    description: string;
    icon: string;
  }> = [
    // Competency badges — silver
    { id: "clarification-silver", name: "clarification-silver", label: "清晰表达者", tier: "silver", dimension: "clarification", category: "competency", description: "需求澄清力评分 ≥60 持续 2 周", icon: "🎯" },
    { id: "decomposition-silver", name: "decomposition-silver", label: "小拆分家", tier: "silver", dimension: "decomposition", category: "competency", description: "分解力评分 ≥60 持续 2 周", icon: "🧩" },
    { id: "execution-silver", name: "execution-silver", label: "行动派", tier: "silver", dimension: "execution", category: "competency", description: "执行力评分 ≥60 持续 2 周", icon: "⚡" },
    { id: "reflection-silver", name: "reflection-silver", label: "思考者", tier: "silver", dimension: "reflection", category: "competency", description: "反思力评分 ≥60 持续 2 周", icon: "💭" },
    { id: "creativity-silver", name: "creativity-silver", label: "创意火花", tier: "silver", dimension: "creativity", category: "competency", description: "创造力评分 ≥60 持续 2 周", icon: "✨" },
    { id: "persistence-silver", name: "persistence-silver", label: "坚持者", tier: "silver", dimension: "persistence", category: "competency", description: "坚持力评分 ≥60 持续 2 周", icon: "🌱" },
    // Competency badges — gold
    { id: "clarification-gold", name: "clarification-gold", label: "需求大师", tier: "gold", dimension: "clarification", category: "competency", description: "需求澄清力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "decomposition-gold", name: "decomposition-gold", label: "分解大师", tier: "gold", dimension: "decomposition", category: "competency", description: "分解力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "execution-gold", name: "execution-gold", label: "执行达人", tier: "gold", dimension: "execution", category: "competency", description: "执行力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "reflection-gold", name: "reflection-gold", label: "反思之星", tier: "gold", dimension: "reflection", category: "competency", description: "反思力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "creativity-gold", name: "creativity-gold", label: "创造大师", tier: "gold", dimension: "creativity", category: "competency", description: "创造力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "persistence-gold", name: "persistence-gold", label: "毅力冠军", tier: "gold", dimension: "persistence", category: "competency", description: "坚持力评分 ≥80 持续 4 周", icon: "🏅" },
    // Achievement badges
    { id: "first-complete", name: "first-complete", label: "首次完成", tier: "silver", dimension: null, category: "achievement", description: "完成第一个项目", icon: "🚀" },
    { id: "streak-21", name: "streak-21", label: "21天挑战", tier: "gold", dimension: null, category: "achievement", description: "连续打卡 21 天", icon: "📅" },
    { id: "comeback", name: "comeback", label: "卷土重来", tier: "silver", dimension: null, category: "achievement", description: "恢复暂停项目 3 次以上", icon: "🔄" },
  ];

  const insert = db.prepare(
    `INSERT INTO badges (id, name, label, tier, dimension, category, description, icon, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const b of badges) {
    insert.run(b.id, b.name, b.label, b.tier, b.dimension, b.category, b.description, b.icon, now);
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 5: Commit**

```bash
git add lib/db/competency-snapshots.ts lib/db/evidence-events.ts lib/db/badges.ts
git commit -m "feat(p3): add competency snapshots, evidence events, badges CRUD"
```

---

### Task 4: 能力评分引擎

**Files:**
- Create: `lib/engine/competency-scorer.ts`

**Interfaces:**
- Consumes: `getWeekEvents` from `lib/db/evidence-events`, `getEventsByDimension` from `lib/db/evidence-events`, `upsertSnapshot` from `lib/db/competency-snapshots`, `routeModel` from `lib/models/router`, `getDb` from `lib/db/index`, `CompetencyDimension` type
- Produces: `generateSnapshot(weekStart: string) → Promise<CompetencySnapshot[]>`, `computeExecutionScore(weekStart: string) → number`, `computePersistenceScore(weekStart: string) → number`

- [ ] **Step 1: Create lib/engine/competency-scorer.ts**

```typescript
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
  clarification: "能否清晰表达想要什么、能区分"想要"和"需要"、能否细化模糊想法",
  decomposition: "能否把大目标拆成小步骤、步骤之间逻辑是否合理",
  execution: "任务完成频率和打卡规律性",
  reflection: "回答是否具体（不是"挺好的"）、能否指出具体困难、是否有改进想法",
  creativity: "想法是否多样、是否有原创性、是否尝试不同角度",
  persistence: "项目持续天数、中断后恢复次数",
};

async function evaluateWithAI(
  dimension: CompetencyDimension,
  events: EvidenceEvent[]
): Promise<{ score: number; summary: string; evidence: Array<{ quote: string; source: string; weight: string }> }> {
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
      temperature: 0.3,
    });

    if (!response) throw new Error("No AI response");

    let json = response.trim();
    const match = json.match(/```json?\n?([\s\S]*?)```/);
    if (match) json = match[1].trim();

    const result = JSON.parse(json);

    // Validate evidence array
    if (!Array.isArray(result.evidence)) result.evidence = [];
    result.evidence = result.evidence.slice(0, 5); // max 5 evidence items

    return {
      score: Math.max(0, Math.min(100, Math.round(result.score))),
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
    const { score, summary, evidence } = await evaluateWithAI(dim, dimEvents);
    results.push(
      upsertSnapshot(weekStart, dim, score, "ai", JSON.stringify(evidence))
    );
  }

  return results;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add lib/engine/competency-scorer.ts
git commit -m "feat(p3): add competency scoring engine (rule + AI)"
```

---

### Task 5: 徽章评定引擎

**Files:**
- Create: `lib/engine/badge-evaluator.ts`

**Interfaces:**
- Consumes: `getAllBadges`, `markBadgeEarned`, `initBadges` from `lib/db/badges`, `getSnapshotsByRange`, `getLatestSnapshots` from `lib/db/competency-snapshots`, `getDb` from `lib/db/index`, `Badge`, `CompetencyDimension`, `CompetencySnapshot` types
- Produces: `checkBadges() → Promise<Badge[]>`, `initBadgesIfNeeded() → void`, `BadgeEvaluator` default export wrapping init + check

- [ ] **Step 1: Create lib/engine/badge-evaluator.ts**

```typescript
import type { Badge, CompetencyDimension, CompetencySnapshot } from "@/lib/utils/types";
import { getAllBadges, markBadgeEarned, initBadges } from "@/lib/db/badges";
import { getSnapshotsByRange, getLatestSnapshots } from "@/lib/db/competency-snapshots";
import { getDb } from "@/lib/db/index";

function getWeekOffset(weekStart: string, offset: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset * 7);
  return d.toISOString().slice(0, 10);
}

/** Check if a dimension score has been ≥threshold for `sustainedWeeks` consecutive weeks */
function scoreSustained(
  dimension: CompetencyDimension,
  threshold: number,
  sustainedWeeks: number
): boolean {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  const currentWeekStart = monday.toISOString().slice(0, 10);

  const startWeek = getWeekOffset(currentWeekStart, -(sustainedWeeks - 1));
  const snapshots = getSnapshotsByRange(startWeek, currentWeekStart);

  const dimSnapshots = snapshots.filter(s => s.dimension === dimension);

  // Need at least sustainedWeeks snapshots at or above threshold
  let consecutive = 0;
  for (let i = 0; i < sustainedWeeks; i++) {
    const week = getWeekOffset(startWeek, i);
    const snap = dimSnapshots.find(s => s.week_start === week);
    if (snap && snap.score >= threshold) {
      consecutive++;
    } else {
      consecutive = 0;
    }
  }

  return consecutive >= sustainedWeeks;
}

function checkAchievementBadge(badge: Badge): boolean {
  const db = getDb();

  switch (badge.name) {
    case "first-complete": {
      const row = db.prepare(
        "SELECT COUNT(*) as count FROM projects WHERE status = 'completed'"
      ).get() as { count: number };
      return row.count >= 1;
    }
    case "streak-21": {
      // Check longest streak ever reached ≥21
      const checkIns = db.prepare(
        "SELECT DISTINCT date FROM check_ins ORDER BY date ASC"
      ).all() as Array<{ date: string }>;

      if (checkIns.length === 0) return false;

      let maxStreak = 0;
      let currentStreak = 1;
      const dates = checkIns.map(c => c.date);

      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = 1;
        }
      }
      maxStreak = Math.max(maxStreak, currentStreak);
      return maxStreak >= 21;
    }
    case "comeback": {
      const row = db.prepare(
        "SELECT COUNT(*) as count FROM project_logs WHERE action = 'project_resume'"
      ).get() as { count: number };
      return row.count >= 3;
    }
    default:
      return false;
  }
}

export function initBadgesIfNeeded(): void {
  initBadges();
}

/** Check all unearned badges. Returns newly earned badges (empty array if none). */
export function checkBadges(): Badge[] {
  const allBadges = getAllBadges();
  const unearned = allBadges.filter(b => !b.earned_at);
  const newlyEarned: Badge[] = [];

  for (const badge of unearned) {
    let earned = false;

    if (badge.category === "competency" && badge.dimension) {
      const threshold = badge.tier === "gold" ? 80 : 60;
      const weeks = badge.tier === "gold" ? 4 : 2;
      earned = scoreSustained(badge.dimension as CompetencyDimension, threshold, weeks);
    } else if (badge.category === "achievement") {
      earned = checkAchievementBadge(badge);
    }

    if (earned) {
      const updated = markBadgeEarned(badge.id);
      if (updated) newlyEarned.push(updated);
    }
  }

  return newlyEarned;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add lib/engine/badge-evaluator.ts
git commit -m "feat(p3): add badge evaluator engine"
```

---

### Task 6: P2 API 埋点（证据事件采集接入）

**Files:**
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/[id]/route.ts`
- Modify: `app/api/tasks/[id]/done/route.ts`
- Modify: `app/api/projects/[id]/check-in/route.ts`
- Modify: `app/api/projects/[id]/reflect/route.ts`

**Interfaces:**
- Consumes: `recordEvent` from `lib/engine/evidence-collector`

- [ ] **Step 1: Add event recording to POST /api/tasks/[id]/done**

Read the existing `app/api/tasks/[id]/done/route.ts` first, then add after the task toggle logic. Add import:

```typescript
import { recordEvent } from "@/lib/engine/evidence-collector";
```

After the task status toggle succeeds (the `db.prepare` for task update), add:

```typescript
// Record evidence event
const taskRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as {
  id: string; title: string; status: string; milestone_id: string;
};
recordEvent(
  newStatus === "done" ? "execution" : "execution",
  "task_done",
  "tasks",
  taskId,
  { title: taskRow?.title, status: newStatus }
);
```

- [ ] **Step 2: Add event recording to POST /api/projects/[id]/check-in**

Add import and after successful check-in upsert:

```typescript
import { recordEvent } from "@/lib/engine/evidence-collector";

// After upsert succeeds:
recordEvent("execution", "check_in", "check_ins", checkIn.id, { date, summary });
```

- [ ] **Step 3: Add event recording to POST /api/projects/[id]/reflect**

Add import and after reflection creation:

```typescript
import { recordEvent } from "@/lib/engine/evidence-collector";

// After createReflection succeeds:
recordEvent("reflection", "reflection_submit", "reflections", reflection.id, {
  type: reflection.type,
  has_q1: !!reflection.q1,
  has_q2: !!reflection.q2,
  has_q3: !!reflection.q3,
  has_q4: !!reflection.q4,
});
```

- [ ] **Step 4: Add event recording to POST /api/projects (project creation)**

Add after `addLog(project.id, "task_done", "项目创建成功")`:

```typescript
recordEvent("creativity", "project_created", "projects", project.id, { title });
```

- [ ] **Step 5: Add event recording to PUT /api/projects/[id] (status changes)**

In `app/api/projects/[id]/route.ts` PUT handler, after `updateProject` call, check if status changed:

```typescript
if (body.status === "completed") {
  recordEvent("persistence", "project_complete", "projects", id, {});
} else if (body.status === "active") {
  // Check if transitioning from paused
  const prev = getProject(id);
  if (prev?.status === "paused") {
    recordEvent("persistence", "project_resume", "projects", id, {});
  }
}
```

Also add the import:
```typescript
import { recordEvent } from "@/lib/engine/evidence-collector";
import { getProject } from "@/lib/db/projects";
```

- [ ] **Step 6: Verify build and test**

Run: `npm run build`
Expected: successful build.

Run: `npm run dev` (background), then use curl to verify events are written:
```bash
# Create a test event via API, then check db
# Verify evidence_events has rows after performing task toggle, check-in, etc.
```

- [ ] **Step 7: Commit**

```bash
git add app/api/
git commit -m "feat(p3): wire evidence event recording into P2 API routes"
```

---

### Task 7: 成长 / 徽章 / 报告 API 路由

**Files:**
- Create: `app/api/competency/route.ts`
- Create: `app/api/badges/route.ts`
- Create: `app/api/report/route.ts`

**Interfaces:**
- Consumes: `generateSnapshot`, `computeExecutionScore`, `computePersistenceScore` from `lib/engine/competency-scorer`, `checkBadges`, `initBadgesIfNeeded` from `lib/engine/badge-evaluator`, `getLatestSnapshots`, `getSnapshotsByRange` from `lib/db/competency-snapshots`, `getAllBadges`, `getEarnedBadges` from `lib/db/badges`, `hasWeekEvents` from `lib/db/evidence-events`, `getCurrentWeekStart` from `lib/engine/evidence-collector`, `getDb` from `lib/db/index`
- Produces: `GET/POST /api/competency`, `GET/POST /api/badges`, `GET /api/report`

- [ ] **Step 1: Create app/api/competency/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { generateSnapshot } from "@/lib/engine/competency-scorer";
import { checkBadges, initBadgesIfNeeded } from "@/lib/engine/badge-evaluator";
import { getLatestSnapshots, getSnapshotsByRange } from "@/lib/db/competency-snapshots";
import { hasWeekEvents } from "@/lib/db/evidence-events";
import { getCurrentWeekStart } from "@/lib/engine/evidence-collector";

export async function GET() {
  initBadgesIfNeeded();
  const snapshots = getLatestSnapshots();
  const weekStart = getCurrentWeekStart();

  // Build trends: last 8 weeks
  const eightWeeksAgo = new Date(weekStart);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const startStr = eightWeeksAgo.toISOString().slice(0, 10);
  const allSnapshots = getSnapshotsByRange(startStr, weekStart);

  // Group by week_start
  const trends: Array<{ week_start: string; scores: Record<string, number> }> = [];
  const weekMap = new Map<string, Record<string, number>>();
  for (const s of allSnapshots) {
    if (!weekMap.has(s.week_start)) weekMap.set(s.week_start, {});
    weekMap.get(s.week_start)![s.dimension] = s.score;
  }
  for (const [ws, scores] of weekMap) {
    trends.push({ week_start: ws, scores });
  }
  trends.sort((a, b) => a.week_start.localeCompare(b.week_start));

  const latestWeek = snapshots[0]?.week_start || "";
  const snapshotMap: Record<string, { score: number; score_type: string; evidence: string }> = {};
  for (const s of snapshots) {
    snapshotMap[s.dimension] = { score: s.score, score_type: s.score_type, evidence: s.evidence };
  }

  return NextResponse.json({
    snapshots: snapshotMap,
    latest_week: latestWeek,
    trends,
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action?: string };

  if (action === "snapshot") {
    const weekStart = getCurrentWeekStart();

    // Skip if no new events this week
    if (!hasWeekEvents(weekStart)) {
      return NextResponse.json({
        snapshots: {},
        new_badges: [],
        skipped: true,
        message: "本周无新行为数据",
      });
    }

    initBadgesIfNeeded();
    const snapshots = await generateSnapshot(weekStart);
    const newBadges = checkBadges();

    const snapshotMap: Record<string, { score: number; score_type: string; evidence: string }> = {};
    for (const s of snapshots) {
      snapshotMap[s.dimension] = { score: s.score, score_type: s.score_type, evidence: s.evidence };
    }

    return NextResponse.json({
      snapshots: snapshotMap,
      new_badges: newBadges.map(b => ({ id: b.id, label: b.label, icon: b.icon })),
      skipped: false,
    });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
```

- [ ] **Step 2: Create app/api/badges/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAllBadges, getEarnedBadges } from "@/lib/db/badges";
import { checkBadges, initBadgesIfNeeded } from "@/lib/engine/badge-evaluator";

export async function GET(req: NextRequest) {
  initBadgesIfNeeded();

  const url = new URL(req.url);
  const earnedOnly = url.searchParams.get("earned") === "true";

  const badges = earnedOnly ? getEarnedBadges() : getAllBadges();

  return NextResponse.json({
    badges,
    earned_count: getEarnedBadges().length,
    total_count: getAllBadges().length,
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action?: string };

  if (action === "check") {
    initBadgesIfNeeded();
    const newBadges = checkBadges();
    return NextResponse.json({
      new_badges: newBadges.map(b => ({ id: b.id, label: b.label, icon: b.icon })),
    });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
```

- [ ] **Step 3: Create app/api/report/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSnapshotsByRange } from "@/lib/db/competency-snapshots";
import { getEarnedBadges } from "@/lib/db/badges";
import { getDb } from "@/lib/db/index";
import { getCurrentWeekStart } from "@/lib/engine/evidence-collector";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const weeks = parseInt(url.searchParams.get("weeks") || "4", 10);

  const currentWeekStart = getCurrentWeekStart();
  const startDate = new Date(currentWeekStart);
  startDate.setDate(startDate.getDate() - (weeks - 1) * 7);
  const startWeek = startDate.toISOString().slice(0, 10);

  const snapshots = getSnapshotsByRange(startWeek, currentWeekStart);

  // Group by week_start
  const trends: Array<{ week_start: string; scores: Record<string, number> }> = [];
  const weekMap = new Map<string, Record<string, number>>();
  for (const s of snapshots) {
    if (!weekMap.has(s.week_start)) weekMap.set(s.week_start, {});
    weekMap.get(s.week_start)![s.dimension] = s.score;
  }
  for (const [ws, scores] of weekMap) {
    trends.push({ week_start: ws, scores });
  }
  trends.sort((a, b) => a.week_start.localeCompare(b.week_start));

  // Project summary
  const db = getDb();
  const projectStats = db.prepare(
    `SELECT
       COUNT(*) as total_projects,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
     FROM projects`
  ).get() as { total_projects: number; completed_projects: number };

  const taskStats = db.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
     FROM tasks`
  ).get() as { total: number; done: number };

  const badges = getEarnedBadges();

  // Current streak
  const checkIns = db.prepare(
    "SELECT DISTINCT date FROM check_ins ORDER BY date DESC"
  ).all() as Array<{ date: string }>;
  let currentStreak = 0;
  if (checkIns.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const latestDate = checkIns[0].date;
    // Only count streak if latest check-in is today or yesterday
    const diffToNow = Math.round(
      (new Date(today).getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffToNow <= 1) {
      currentStreak = 1;
      for (let i = 1; i < checkIns.length; i++) {
        const prev = new Date(checkIns[i - 1]);
        const curr = new Date(checkIns[i]);
        const diff = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) currentStreak++;
        else break;
      }
    }
  }

  return NextResponse.json({
    time_range: {
      start: startWeek,
      end: currentWeekStart,
    },
    trends,
    summary: {
      total_projects: projectStats.total_projects,
      completed_projects: projectStats.completed_projects,
      total_tasks: taskStats.total,
      total_tasks_done: taskStats.done,
      task_completion_rate: taskStats.total > 0
        ? Math.round((taskStats.done / taskStats.total) * 100) / 100
        : 0,
      badges_earned: badges.length,
      current_streak: currentStreak,
    },
  });
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 5: Commit**

```bash
git add app/api/competency/ app/api/badges/ app/api/report/
git commit -m "feat(p3): add competency, badges, report API routes"
```

---

### Task 8: 成长面板 Zustand Store

**Files:**
- Create: `lib/store/growth-store.ts`

**Interfaces:**
- Consumes: `CompetencySnapshot`, `Badge` types
- Produces: `useGrowthStore` — `{ snapshots, badges, trends, newBadges, summary, loading, fetchGrowthData, triggerSnapshot, clearNewBadges }`

- [ ] **Step 1: Create lib/store/growth-store.ts**

```typescript
import { create } from "zustand";

interface SnapshotMap {
  [dimension: string]: { score: number; score_type: string; evidence: string };
}

interface TrendPoint {
  week_start: string;
  scores: Record<string, number>;
}

interface BadgeItem {
  id: string;
  name: string;
  label: string;
  tier: string;
  dimension: string | null;
  category: string;
  description: string;
  icon: string;
  earned_at: string | null;
}

interface ReportSummary {
  total_projects: number;
  completed_projects: number;
  total_tasks: number;
  total_tasks_done: number;
  task_completion_rate: number;
  badges_earned: number;
  current_streak: number;
}

interface NewBadge {
  id: string;
  label: string;
  icon: string;
}

interface GrowthState {
  snapshots: SnapshotMap;
  badges: BadgeItem[];
  trends: TrendPoint[];
  newBadges: NewBadge[];
  summary: ReportSummary | null;
  loading: boolean;

  fetchGrowthData: () => Promise<void>;
  triggerSnapshot: () => Promise<void>;
  clearNewBadges: () => void;
}

export const useGrowthStore = create<GrowthState>((set) => ({
  snapshots: {},
  badges: [],
  trends: [],
  newBadges: [],
  summary: null,
  loading: false,

  fetchGrowthData: async () => {
    set({ loading: true });
    try {
      const [compRes, badgeRes] = await Promise.all([
        fetch("/api/competency"),
        fetch("/api/badges"),
      ]);
      const compData = await compRes.json();
      const badgeData = await badgeRes.json();

      set({
        snapshots: compData.snapshots || {},
        trends: compData.trends || [],
        badges: badgeData.badges || [],
      });
    } catch (e) {
      console.error("Failed to fetch growth data", e);
    } finally {
      set({ loading: false });
    }
  },

  triggerSnapshot: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/competency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snapshot" }),
      });
      const data = await res.json();

      if (data.snapshots && Object.keys(data.snapshots).length > 0) {
        set({ snapshots: data.snapshots });
      }

      if (data.new_badges?.length > 0) {
        set({ newBadges: data.new_badges });
      }
    } catch (e) {
      console.error("Failed to trigger snapshot", e);
    } finally {
      set({ loading: false });
    }
  },

  clearNewBadges: () => set({ newBadges: [] }),
}));
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add lib/store/growth-store.ts
git commit -m "feat(p3): add growth panel Zustand store"
```

---

### Task 9: SVG 图表组件（雷达图 + 趋势线）

**Files:**
- Create: `components/growth/radar-chart.tsx`
- Create: `components/growth/trend-line.tsx`

**Interfaces:**
- Consumes: `SnapshotMap` from growth-store pattern
- Produces: `RadarChart` (props: `data: Record<string, number>`, `labels: Record<string, string>`, `size?: number`), `TrendLine` (props: `trends: TrendPoint[]`, `dimensions: string[]`, `labels: Record<string, string>`, `colors: Record<string, string>`)

- [ ] **Step 1: Create components/growth/radar-chart.tsx**

```typescript
"use client";

interface RadarChartProps {
  data: Record<string, number>; // dimension → 0-100 score
  labels: Record<string, string>; // dimension → Chinese label
  size?: number;
}

const DEFAULT_DIMENSIONS = [
  "clarification",
  "decomposition",
  "execution",
  "reflection",
  "creativity",
  "persistence",
];

export function RadarChart({ data, labels, size = 280 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const levels = 5; // 20, 40, 60, 80, 100

  const dims = DEFAULT_DIMENSIONS;
  const angleStep = (2 * Math.PI) / dims.length;
  const startAngle = -Math.PI / 2; // Start from top

  // Grid rings
  const rings = Array.from({ length: levels }, (_, i) => {
    const r = radius * ((i + 1) / levels);
    const points = dims
      .map((_, j) => {
        const a = startAngle + j * angleStep;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      })
      .join(" ");
    return (
      <polygon
        key={`ring-${i}`}
        points={points}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={i === levels - 1 ? 1.5 : 0.5}
      />
    );
  });

  // Axes
  const axes = dims.map((_, i) => {
    const a = startAngle + i * angleStep;
    return (
      <line
        key={`axis-${i}`}
        x1={cx}
        y1={cy}
        x2={cx + radius * Math.cos(a)}
        y2={cy + radius * Math.sin(a)}
        stroke="#e5e7eb"
        strokeWidth={0.5}
      />
    );
  });

  // Data polygon
  const dataPoints = dims
    .map((dim, i) => {
      const score = data[dim] || 0;
      const r = radius * (score / 100);
      const a = startAngle + i * angleStep;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    })
    .join(" ");

  // Dim labels
  const labelElements = dims.map((dim, i) => {
    const a = startAngle + i * angleStep;
    const labelR = radius + 32;
    const lx = cx + labelR * Math.cos(a);
    const ly = cy + labelR * Math.sin(a);
    return (
      <text
        key={`label-${i}`}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-ink-tertiary text-[11px]"
      >
        {labels[dim] || dim}
      </text>
    );
  });

  // Score dots
  const dots = dims.map((dim, i) => {
    const score = data[dim] || 0;
    const r = radius * (score / 100);
    const a = startAngle + i * angleStep;
    return (
      <circle
        key={`dot-${i}`}
        cx={cx + r * Math.cos(a)}
        cy={cy + r * Math.sin(a)}
        r={3}
        className="fill-primary"
      />
    );
  });

  // Score labels
  const scoreLabels = dims.map((dim, i) => {
    const score = data[dim] || 0;
    const r = radius * (score / 100) + 14;
    const a = startAngle + i * angleStep;
    return (
      <text
        key={`score-${i}`}
        x={cx + r * Math.cos(a)}
        y={cy + r * Math.sin(a)}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-ink text-[10px] font-semibold"
      >
        {score}
      </text>
    );
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="mx-auto"
    >
      {rings}
      {axes}
      <polygon
        points={dataPoints}
        fill="rgba(99, 102, 241, 0.15)"
        stroke="rgb(99, 102, 241)"
        strokeWidth={2}
      />
      {dots}
      {scoreLabels}
      {labelElements}
    </svg>
  );
}
```

- [ ] **Step 2: Create components/growth/trend-line.tsx**

```typescript
"use client";

interface TrendPoint {
  week_start: string;
  scores: Record<string, number>;
}

interface TrendLineProps {
  trends: TrendPoint[];
  dimensions: string[];
  labels: Record<string, string>;
  colors: Record<string, string>;
  width?: number;
  height?: number;
}

const DEFAULT_COLORS: Record<string, string> = {
  clarification: "#6366f1",
  decomposition: "#8b5cf6",
  execution: "#10b981",
  reflection: "#f59e0b",
  creativity: "#ec4899",
  persistence: "#3b82f6",
};

export function TrendLine({
  trends,
  dimensions,
  labels,
  colors = DEFAULT_COLORS,
  width = 600,
  height = 240,
}: TrendLineProps) {
  if (trends.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-tertiary text-body-sm">
        暂无趋势数据
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Format week label
  function formatWeek(ws: string): string {
    const parts = ws.split("-");
    return `${parts[1]}/${parts[2]}`;
  }

  // Y grid lines (every 20)
  const yGrid = [0, 20, 40, 60, 80, 100].map(score => {
    const y = padding.top + plotH - (score / 100) * plotH;
    return (
      <g key={`ygrid-${score}`}>
        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
        <text x={padding.left - 6} y={y + 4} textAnchor="end" className="fill-ink-tertiary text-[10px]">
          {score}
        </text>
      </g>
    );
  });

  // X labels
  const xStep = trends.length > 1 ? plotW / (trends.length - 1) : plotW;
  const xLabels = trends.map((t, i) => {
    const x = padding.left + i * xStep;
    return (
      <text
        key={`x-${i}`}
        x={x}
        y={height - 8}
        textAnchor="middle"
        className="fill-ink-tertiary text-[10px]"
      >
        {formatWeek(t.week_start)}
      </text>
    );
  });

  // Lines per dimension
  const lines = dimensions.map(dim => {
    const points = trends
      .map((t, i) => {
        const score = t.scores[dim];
        if (score === undefined) return null;
        const x = padding.left + i * xStep;
        const y = padding.top + plotH - (score / 100) * plotH;
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(" ");

    if (!points) return null;

    return (
      <g key={`line-${dim}`}>
        <polyline
          points={points}
          fill="none"
          stroke={colors[dim] || "#6366f1"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {trends.map((t, i) => {
          const score = t.scores[dim];
          if (score === undefined) return null;
          const x = padding.left + i * xStep;
          const y = padding.top + plotH - (score / 100) * plotH;
          return (
            <circle
              key={`dot-${dim}-${i}`}
              cx={x}
              cy={y}
              r={3}
              fill={colors[dim] || "#6366f1"}
            />
          );
        })}
      </g>
    );
  });

  // Legend
  const legend = dimensions.map((dim, i) => {
    const x = padding.left + i * 90;
    return (
      <g key={`legend-${dim}`}>
        <rect x={x} y={4} width={10} height={10} rx={2} fill={colors[dim] || "#6366f1"} />
        <text x={x + 14} y={13} className="fill-ink-tertiary text-[11px]">
          {labels[dim] || dim}
        </text>
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-2xl">
      {yGrid}
      {xLabels}
      {lines}
      {legend}
    </svg>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add components/growth/radar-chart.tsx components/growth/trend-line.tsx
git commit -m "feat(p3): add SVG radar chart and trend line components"
```

---

### Task 10: 徽章墙组件

**Files:**
- Create: `components/growth/badge-card.tsx`
- Create: `components/growth/badge-wall.tsx`

**Interfaces:**
- Consumes: `Badge` type from `lib/utils/types`
- Produces: `BadgeCard` (props: `badge: Badge`), `BadgeWall` (props: `badges: Badge[]`)

- [ ] **Step 1: Create components/growth/badge-card.tsx**

```typescript
"use client";

import type { Badge } from "@/lib/utils/types";

interface BadgeCardProps {
  badge: Badge;
}

export function BadgeCard({ badge }: BadgeCardProps) {
  const earned = !!badge.earned_at;
  const earnedDate = badge.earned_at
    ? new Date(badge.earned_at).toLocaleDateString("zh-CN")
    : null;

  return (
    <div
      className={`relative flex flex-col items-center p-3 rounded-card border transition-all ${
        earned
          ? "border-primary/30 bg-surface-raised shadow-sm"
          : "border-border bg-surface opacity-50 grayscale"
      }`}
    >
      <span className="text-2xl">{badge.icon}</span>
      <span className={`text-body-sm font-semibold mt-1 ${earned ? "text-ink" : "text-ink-tertiary"}`}>
        {badge.label}
      </span>
      {badge.tier === "gold" && earned && (
        <span className="text-[10px] text-yellow-500 mt-0.5">★ 金</span>
      )}
      {badge.tier === "silver" && earned && (
        <span className="text-[10px] text-slate-400 mt-0.5">· 银</span>
      )}
      {earnedDate && (
        <span className="text-[10px] text-ink-tertiary mt-0.5">{earnedDate}</span>
      )}
      {!earned && (
        <span className="text-[10px] text-ink-tertiary mt-1 text-center leading-tight">
          {badge.description}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create components/growth/badge-wall.tsx**

```typescript
"use client";

import type { Badge } from "@/lib/utils/types";
import { BadgeCard } from "./badge-card";

interface BadgeWallProps {
  badges: Badge[];
}

const DIMENSION_LABELS: Record<string, string> = {
  clarification: "需求澄清力",
  decomposition: "分解力",
  execution: "执行力",
  reflection: "反思力",
  creativity: "创造力",
  persistence: "坚持力",
};

export function BadgeWall({ badges }: BadgeWallProps) {
  // Group by category, then dimension
  const competencyBadges = badges.filter(b => b.category === "competency");
  const achievementBadges = badges.filter(b => b.category === "achievement");

  // Group competency by dimension
  const grouped = new Map<string, Badge[]>();
  for (const b of competencyBadges) {
    const key = b.dimension || "other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  }

  return (
    <div className="space-y-5">
      {/* Competency badges grouped by dimension */}
      {Array.from(grouped.entries()).map(([dim, dimBadges]) => (
        <div key={dim}>
          <h4 className="text-body-sm font-semibold text-ink-secondary mb-2">
            {DIMENSION_LABELS[dim] || dim}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {dimBadges.map(b => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        </div>
      ))}

      {/* Achievement badges */}
      {achievementBadges.length > 0 && (
        <div>
          <h4 className="text-body-sm font-semibold text-ink-secondary mb-2">成就徽章</h4>
          <div className="grid grid-cols-3 gap-2">
            {achievementBadges.map(b => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add components/growth/badge-card.tsx components/growth/badge-wall.tsx
git commit -m "feat(p3): add badge wall components"
```

---

### Task 11: 成长面板页面

**Files:**
- Create: `app/growth/page.tsx`

**Interfaces:**
- Consumes: `useGrowthStore` from `lib/store/growth-store`, `RadarChart`, `BadgeWall`, `TrendLine`

- [ ] **Step 1: Create app/growth/page.tsx**

```typescript
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useGrowthStore } from "@/lib/store/growth-store";
import { RadarChart } from "@/components/growth/radar-chart";
import { BadgeWall } from "@/components/growth/badge-wall";
import { TrendLine } from "@/components/growth/trend-line";

const DIM_LABELS: Record<string, string> = {
  clarification: "需求澄清",
  decomposition: "分解力",
  execution: "执行力",
  reflection: "反思力",
  creativity: "创造力",
  persistence: "坚持力",
};

const DIM_COLORS: Record<string, string> = {
  clarification: "#6366f1",
  decomposition: "#8b5cf6",
  execution: "#10b981",
  reflection: "#f59e0b",
  creativity: "#ec4899",
  persistence: "#3b82f6",
};

export default function GrowthPage() {
  const {
    snapshots,
    badges,
    trends,
    newBadges,
    loading,
    fetchGrowthData,
    triggerSnapshot,
    clearNewBadges,
  } = useGrowthStore();

  useEffect(() => {
    fetchGrowthData().then(() => {
      // Trigger snapshot if needed (API handles idempotency)
      triggerSnapshot();
    });
  }, []);

  // Show new badge celebration
  useEffect(() => {
    if (newBadges.length > 0) {
      const timer = setTimeout(() => clearNewBadges(), 5000);
      return () => clearTimeout(timer);
    }
  }, [newBadges]);

  // Build radar data from snapshots
  const radarData: Record<string, number> = {};
  for (const [dim, info] of Object.entries(snapshots)) {
    radarData[dim] = info.score;
  }

  const allDims = Object.keys(DIM_LABELS);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">🌟 我的成长</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* New badge celebration */}
      {newBadges.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in">
          <div className="bg-white rounded-card p-8 text-center shadow-xl animate-in zoom-in-95">
            <p className="text-body-lg font-bold text-ink mb-2">🎉 新徽章解锁！</p>
            {newBadges.map(b => (
              <div key={b.id} className="flex items-center justify-center gap-2 my-2">
                <span className="text-3xl">{b.icon}</span>
                <span className="text-body font-semibold">{b.label}</span>
              </div>
            ))}
            <button
              onClick={clearNewBadges}
              className="mt-4 bg-primary text-white border-none rounded-btn px-6 py-2 font-semibold text-body-sm"
            >
              太棒了！
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          {/* Radar chart */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">📊 能力画像</h2>
            {Object.keys(radarData).length > 0 ? (
              <RadarChart data={radarData} labels={DIM_LABELS} size={320} />
            ) : (
              <p className="text-ink-tertiary text-body-sm text-center py-8">
                还没有能力数据，完成一些项目任务后回来看看吧！
              </p>
            )}
          </section>

          {/* Trend line */}
          {trends.length > 1 && (
            <section className="bg-surface border border-border rounded-card p-6">
              <h2 className="text-body-lg font-bold mb-4">📈 能力趋势</h2>
              <TrendLine
                trends={trends}
                dimensions={allDims}
                labels={DIM_LABELS}
                colors={DIM_COLORS}
              />
            </section>
          )}

          {/* Badge wall */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">🏆 徽章墙</h2>
            {badges.length > 0 ? (
              <BadgeWall badges={badges} />
            ) : (
              <p className="text-ink-tertiary text-body-sm text-center py-8">徽章加载中...</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add app/growth/page.tsx
git commit -m "feat(p3): add growth panel page"
```

---

### Task 12: 作品墙页面

**Files:**
- Create: `components/showcase/project-showcase-card.tsx`
- Create: `app/showcase/page.tsx`

**Interfaces:**
- Consumes: `Project` type, existing `getDb` (via API), localStorage for featured state

- [ ] **Step 1: Create components/showcase/project-showcase-card.tsx**

```typescript
"use client";

interface ShowcaseCardProps {
  project: {
    id: string;
    title: string;
    days: number;
    tasksDone: number;
    badges: Array<{ icon: string; label: string }>;
    isFeatured: boolean;
  };
  onToggleFeatured: (id: string) => void;
}

export function ProjectShowcaseCard({ project, onToggleFeatured }: ShowcaseCardProps) {
  return (
    <div
      className={`relative bg-surface border rounded-card p-5 transition-all ${
        project.isFeatured
          ? "border-primary ring-1 ring-primary/30 shadow-md"
          : "border-border hover:shadow-sm"
      }`}
    >
      {project.isFeatured && (
        <span className="absolute top-2 right-2 text-yellow-500 text-sm">★ 精选</span>
      )}

      <h3 className="text-body font-bold text-ink mb-3">{project.title}</h3>

      <div className="flex items-center gap-4 text-body-sm text-ink-tertiary mb-3">
        <span>📅 {project.days} 天</span>
        <span>✅ {project.tasksDone} 任务</span>
      </div>

      {project.badges.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {project.badges.map((b, i) => (
            <span key={i} title={b.label} className="text-lg">
              {b.icon}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => onToggleFeatured(project.id)}
        className={`text-body-xs border rounded-btn px-3 py-1 transition-colors ${
          project.isFeatured
            ? "border-primary text-primary bg-primary/5"
            : "border-border text-ink-tertiary hover:text-ink"
        }`}
      >
        {project.isFeatured ? "取消精选" : "置为精选"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create app/showcase/page.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProjectShowcaseCard } from "@/components/showcase/project-showcase-card";

interface ShowcaseProject {
  id: string;
  title: string;
  days: number;
  tasksDone: number;
  badges: Array<{ icon: string; label: string }>;
  isFeatured: boolean;
}

export default function ShowcasePage() {
  const [projects, setProjects] = useState<ShowcaseProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(data => {
        const completed = (data.projects || []).filter(
          (p: { status: string }) => p.status === "completed"
        );
        // Load featured from localStorage
        let featured: string[] = [];
        try {
          featured = JSON.parse(localStorage.getItem("showcase-featured") || "[]");
        } catch { /* ignore */ }

        const mapped: ShowcaseProject[] = completed.map((p: { id: string; title: string }) => ({
          id: p.id,
          title: p.title,
          days: 0, // Will be populated by detail fetch — acceptable simplification
          tasksDone: 0,
          badges: [],
          isFeatured: featured.includes(p.id),
        }));
        setProjects(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleFeatured = (id: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== id) return p;
        const newFeatured = !p.isFeatured;
        // Update localStorage
        try {
          let featured: string[] = JSON.parse(localStorage.getItem("showcase-featured") || "[]");
          if (newFeatured) {
            if (featured.length >= 2) return p; // Max 2
            featured.push(id);
          } else {
            featured = featured.filter((f: string) => f !== id);
          }
          localStorage.setItem("showcase-featured", JSON.stringify(featured));
        } catch { /* ignore */ }
        return { ...p, isFeatured: newFeatured };
      });
      return updated;
    });
  };

  const featuredProjects = projects.filter(p => p.isFeatured);
  const regularProjects = projects.filter(p => !p.isFeatured);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">🌟 我的作品墙</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-20">
          <p className="text-ink-tertiary text-body-lg mb-2">还没有完成的项目</p>
          <p className="text-ink-tertiary text-body-sm">
            完成一个项目后，它会出现在这里！
          </p>
          <Link
            href="/projects"
            className="inline-block mt-4 text-primary hover:underline"
          >
            去看看我的项目 →
          </Link>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="space-y-6">
          {/* Featured section */}
          {featuredProjects.length > 0 && (
            <section>
              <h2 className="text-body-lg font-bold text-ink mb-3">★ 精选作品</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuredProjects.map(p => (
                  <ProjectShowcaseCard
                    key={p.id}
                    project={p}
                    onToggleFeatured={toggleFeatured}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All projects */}
          <section>
            <h2 className="text-body-lg font-bold text-ink mb-3">
              {featuredProjects.length > 0 ? "全部作品" : ""}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regularProjects.map(p => (
                <ProjectShowcaseCard
                  key={p.id}
                  project={p}
                  onToggleFeatured={toggleFeatured}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add components/showcase/ app/showcase/
git commit -m "feat(p3): add showcase wall page"
```

---

### Task 13: 家长报告页面

**Files:**
- Create: `app/report/page.tsx`

**Interfaces:**
- Consumes: `RadarChart`, `TrendLine` from components, `GET /api/report`

- [ ] **Step 1: Create app/report/page.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RadarChart } from "@/components/growth/radar-chart";
import { TrendLine } from "@/components/growth/trend-line";

const DIM_LABELS: Record<string, string> = {
  clarification: "需求澄清",
  decomposition: "分解力",
  execution: "执行力",
  reflection: "反思力",
  creativity: "创造力",
  persistence: "坚持力",
};

const DIM_COLORS: Record<string, string> = {
  clarification: "#6366f1",
  decomposition: "#8b5cf6",
  execution: "#10b981",
  reflection: "#f59e0b",
  creativity: "#ec4899",
  persistence: "#3b82f6",
};

interface ReportData {
  time_range: { start: string; end: string };
  trends: Array<{ week_start: string; scores: Record<string, number> }>;
  summary: {
    total_projects: number;
    completed_projects: number;
    total_tasks: number;
    total_tasks_done: number;
    task_completion_rate: number;
    badges_earned: number;
    current_streak: number;
  };
}

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [weeks, setWeeks] = useState(4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/report?weeks=${weeks}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [weeks]);

  // Build radar data from latest trend point
  const latestScores: Record<string, number> = {};
  if (data?.trends.length) {
    const latest = data.trends[data.trends.length - 1];
    Object.assign(latestScores, latest.scores);
  }

  const allDims = Object.keys(DIM_LABELS);

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
            ← 返回
          </Link>
          <h1 className="text-2xl font-bold">📊 成长报告</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={weeks}
            onChange={e => setWeeks(Number(e.target.value))}
            className="bg-surface border border-border rounded-btn px-3 py-1.5 text-body-sm"
          >
            <option value={4}>最近 4 周</option>
            <option value={8}>最近 8 周</option>
            <option value={52}>全部</option>
          </select>
          <button
            onClick={handleExport}
            className="bg-primary text-white border-none rounded-btn px-4 py-1.5 font-semibold text-body-sm"
          >
            📄 导出 PDF
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-6">
          {/* Time range */}
          <p className="text-body-sm text-ink-tertiary">
            数据范围：{data.time_range.start} ~ {data.time_range.end}
          </p>

          {/* Radar chart */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">能力画像</h2>
            {Object.keys(latestScores).length > 0 ? (
              <RadarChart data={latestScores} labels={DIM_LABELS} size={300} />
            ) : (
              <p className="text-ink-tertiary text-body-sm text-center py-8">暂无能力数据</p>
            )}
          </section>

          {/* Trend line */}
          {data.trends.length > 1 && (
            <section className="bg-surface border border-border rounded-card p-6 trend-section">
              <h2 className="text-body-lg font-bold mb-4">能力趋势</h2>
              <TrendLine
                trends={data.trends}
                dimensions={allDims}
                labels={DIM_LABELS}
                colors={DIM_COLORS}
              />
            </section>
          )}

          {/* Summary */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">项目摘要</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-page rounded-btn">
                <p className="text-2xl font-bold text-primary">{data.summary.completed_projects}</p>
                <p className="text-body-xs text-ink-tertiary">已完成项目</p>
              </div>
              <div className="text-center p-3 bg-page rounded-btn">
                <p className="text-2xl font-bold text-primary">{data.summary.total_projects}</p>
                <p className="text-body-xs text-ink-tertiary">总项目</p>
              </div>
              <div className="text-center p-3 bg-page rounded-btn">
                <p className="text-2xl font-bold text-primary">
                  {Math.round(data.summary.task_completion_rate * 100)}%
                </p>
                <p className="text-body-xs text-ink-tertiary">任务完成率</p>
              </div>
              <div className="text-center p-3 bg-page rounded-btn">
                <p className="text-2xl font-bold text-primary">{data.summary.badges_earned}</p>
                <p className="text-body-xs text-ink-tertiary">获得徽章</p>
              </div>
            </div>
            <div className="mt-3 text-body-sm text-ink-tertiary">
              当前连续打卡：{data.summary.current_streak} 天
              {" · "}
              完成 {data.summary.total_tasks_done}/{data.summary.total_tasks} 任务
            </div>
          </section>
        </div>
      )}

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .trend-section { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add app/report/page.tsx
git commit -m "feat(p3): add parent report page"
```

---

### Task 14: 导航集成与收尾

**Files:**
- Modify: `app/page.tsx`
- Modify: `DEVELOPMENT.md`

**Interfaces:**
- Consumes: existing nav links in `app/page.tsx`

- [ ] **Step 1: Add P3 navigation links to app/page.tsx**

Add after the existing `<Link href="/projects" ...>` block:

```tsx
<Link
  href="/growth"
  className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
>
  🌟 成长
</Link>
<Link
  href="/showcase"
  className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
>
  🖼 作品
</Link>
<Link
  href="/report"
  className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
>
  📊 报告
</Link>
```

- [ ] **Step 2: Update DEVELOPMENT.md**

Replace the progress line with:

```
P1 ██████████ 100% | P2 ██████████ 100% | P3 ██████████ 100% | P4-P6 未开始
```

Add P3 section after P2:

```markdown
## P3 · 成长可见（目标：2026-08-22）
- [x] Task 1: P3 类型与数据库扩展
- [x] Task 2: 证据事件采集器
- [x] Task 3: 数据库 CRUD 模块
- [x] Task 4: 能力评分引擎
- [x] Task 5: 徽章评定引擎
- [x] Task 6: P2 API 埋点
- [x] Task 7: 成长/徽章/报告 API
- [x] Task 8: 成长面板 Zustand Store
- [x] Task 9: SVG 图表组件
- [x] Task 10: 徽章墙组件
- [x] Task 11: 成长面板页面
- [x] Task 12: 作品墙页面
- [x] Task 13: 家长报告页面
- [x] Task 14: 导航集成与收尾
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: successful build with all P3 pages rendering.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx DEVELOPMENT.md
git commit -m "feat(p3): add navigation links and update DEVELOPMENT.md"
```

---

*Plan complete. 14 tasks, covering types → DB → engines → API → store → components → pages → integration.*
