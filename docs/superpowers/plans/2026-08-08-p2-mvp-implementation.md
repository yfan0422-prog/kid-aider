# Kid-Aider P2 · 项目工坊 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 P1 的方案包转化为可执行的多轨道项目，分多天完成，支持任务打卡、每日总结、三层复盘、智能续接。

**Architecture:** 新增 7 张 SQLite 表 + 7 个 CRUD 模块 + 3 个引擎（拆解/续接/复盘）+ 11 个 API 端点 + 8 个前端组件 + 1 个 Zustand store。通过从 solution_packs 表的方案包触发项目创建，AI 自动拆解为多轨道里程碑任务。

**Tech Stack:** Next.js 14 App Router + TypeScript strict + Tailwind CSS v3 + Zustand v5 + better-sqlite3 + shadcn/ui

## Global Constraints

- Next.js 14 App Router (not Pages Router)
- TypeScript strict mode
- Tailwind CSS v3 with Kid-Aider design tokens (primary #4F7CFF, bg #FAF9F6, etc.)
- better-sqlite3 (synchronous API)
- Zustand v5 for state management
- Chinese (zh-CN) as primary UI language
- "use client" directive on all interactive components
- All new API routes return JSON (not SSE — P2 engine calls are non-streaming)
- Localhost-only deployment; no auth, no multi-tenancy
- Reuse P1's model routing (`routeModel("dialogue")`) for all LLM calls
- Follow existing codebase patterns: `uuid` for IDs, `new Date().toISOString()` for timestamps, `getDb()` singleton

---

## File Structure Map

```
lib/
├── db/
│   ├── index.ts              [MODIFY] add 7 P2 tables
│   ├── projects.ts           [CREATE]  project CRUD
│   ├── tracks.ts             [CREATE]  track CRUD
│   ├── milestones.ts         [CREATE]  milestone CRUD
│   ├── tasks.ts              [CREATE]  task CRUD
│   ├── check-ins.ts          [CREATE]  check-in CRUD
│   ├── reflections.ts        [CREATE]  reflection CRUD
│   └── project-logs.ts       [CREATE]  project log CRUD
├── engine/
│   ├── project-decomposer.ts [CREATE]  AI 拆解引擎
│   ├── resume-builder.ts     [CREATE]  智能续接引擎
│   └── reflection-coach.ts   [CREATE]  复盘教练引擎
├── store/
│   └── project-store.ts      [CREATE]  P2 Zustand store
└── utils/
    └── types.ts              [MODIFY]  add P2 types

app/
├── api/
│   ├── projects/
│   │   ├── route.ts          [CREATE]  GET list / POST create
│   │   └── [id]/
│   │       ├── route.ts      [CREATE]  GET detail / PUT update / DELETE
│   │       ├── tracks/route.ts       [CREATE]
│   │       ├── check-in/route.ts     [CREATE]
│   │       ├── reflect/route.ts      [CREATE]
│   │       └── resume/route.ts       [CREATE]
│   └── tasks/
│       └── [id]/done/route.ts        [CREATE]
└── projects/
    ├── page.tsx              [CREATE]  项目列表
    └── [id]/page.tsx         [CREATE]  项目详情

components/
├── panels/
│   └── solution-preview.tsx  [MODIFY]  add "开始项目" button
└── projects/
    ├── project-card.tsx      [CREATE]
    ├── project-hero.tsx      [CREATE]
    ├── track-column.tsx      [CREATE]
    ├── task-card.tsx         [CREATE]
    ├── check-in-dialog.tsx   [CREATE]
    ├── reflection-dialog.tsx [CREATE]
    ├── calendar-heatmap.tsx  [CREATE]
    └── streak-badge.tsx      [CREATE]
```

---

### Task 1: P2 Types & Database Schema Extension

**Files:**
- Modify: `lib/utils/types.ts`
- Modify: `lib/db/index.ts`

**Interfaces:**
- Produces: `Project`, `Track`, `Milestone`, `Task`, `CheckIn`, `Reflection`, `ProjectLog` types; 7 new tables + 6 indexes

- [ ] **Step 1: Add P2 types**

Append to `lib/utils/types.ts`:

```typescript
export type ProjectStatus = "active" | "paused" | "completed";
export type TrackType = "software" | "diy";
export type ItemStatus = "pending" | "active" | "done";
export type ReflectionType = "daily" | "milestone" | "final";

export interface Project {
  id: string;
  session_id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Track {
  id: string;
  project_id: string;
  name: string;
  type: TrackType;
  sort_order: number;
  status: ItemStatus;
  created_at: string;
}

export interface Milestone {
  id: string;
  track_id: string;
  title: string;
  description: string;
  sort_order: number;
  status: ItemStatus;
  completed_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  milestone_id: string;
  title: string;
  what_to_do: string;
  how_hint: string;
  difficulty: number; // 1-3
  status: ItemStatus;
  completed_at: string | null;
  created_at: string;
}

export interface CheckIn {
  id: string;
  project_id: string;
  date: string; // YYYY-MM-DD
  summary: string;
  created_at: string;
}

export interface Reflection {
  id: string;
  project_id: string;
  type: ReflectionType;
  trigger_ref: string | null;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  created_at: string;
}

export interface ProjectLog {
  id: string;
  project_id: string;
  action: string; // task_done | check_in | reflection | milestone_complete | track_complete
  detail: string;
  created_at: string;
}
```

- [ ] **Step 2: Add P2 tables**

In `lib/db/index.ts`, add these CREATE TABLE statements inside the `db.exec()` call, after the existing tables but before the closing backtick:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'software',
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  what_to_do TEXT NOT NULL,
  how_hint TEXT DEFAULT '',
  difficulty INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS check_ins (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, date)
);

CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  trigger_ref TEXT,
  q1 TEXT DEFAULT '',
  q2 TEXT DEFAULT '',
  q3 TEXT DEFAULT '',
  q4 TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_project ON tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_track ON milestones(track_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_project_date ON check_ins(project_id, date);
CREATE INDEX IF NOT EXISTS idx_reflections_project ON reflections(project_id);
CREATE INDEX IF NOT EXISTS idx_project_logs_project ON project_logs(project_id);
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npm run build
git add lib/utils/types.ts lib/db/index.ts
git commit -m "feat: add P2 types and database schema for project studio

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Project & Track CRUD Modules

**Files:**
- Create: `lib/db/projects.ts`
- Create: `lib/db/tracks.ts`

**Interfaces:**
- Consumes: `getDb()` from `lib/db/index`, `Project`/`Track` types from `lib/utils/types`
- Produces: `createProject()`, `getProject()`, `listProjects()`, `updateProject()`, `deleteProject()`, `createTrack()`, `getTracks()`, `deleteTrack()`

- [ ] **Step 1: Write project CRUD**

Write `lib/db/projects.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Project } from "@/lib/utils/types";

interface CreateProjectAttrs {
  session_id: string;
  title: string;
}

export function createProject(attrs: CreateProjectAttrs): Project {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO projects (id, session_id, title, status, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?)`
  ).run(id, attrs.session_id, attrs.title, now, now);
  return getProject(id)!;
}

export function getProject(id: string): Project | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return row ? (row as Project) : undefined;
}

export function listProjects(): Project[] {
  const db = getDb();
  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Project[];
}

export function updateProject(id: string, attrs: { title?: string; status?: string }): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteProject(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}
```

- [ ] **Step 2: Write track CRUD**

Write `lib/db/tracks.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Track, TrackType } from "@/lib/utils/types";

interface CreateTrackAttrs {
  project_id: string;
  name: string;
  type: TrackType;
  sort_order?: number;
}

export function createTrack(attrs: CreateTrackAttrs): Track {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO tracks (id, project_id, name, type, sort_order, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`
  ).run(id, attrs.project_id, attrs.name, attrs.type, attrs.sort_order || 0, now);
  return db.prepare("SELECT * FROM tracks WHERE id = ?").get(id) as Track;
}

export function getTracks(projectId: string): Track[] {
  const db = getDb();
  return db.prepare("SELECT * FROM tracks WHERE project_id = ? ORDER BY sort_order ASC").all(projectId) as Track[];
}

export function deleteTrack(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM tracks WHERE id = ?").run(id);
}
```

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit
git add lib/db/projects.ts lib/db/tracks.ts
git commit -m "feat: add project and track CRUD modules

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Milestone, Task, Check-in, Reflection & Log CRUD

**Files:**
- Create: `lib/db/milestones.ts`
- Create: `lib/db/tasks.ts`
- Create: `lib/db/check-ins.ts`
- Create: `lib/db/reflections.ts`
- Create: `lib/db/project-logs.ts`

**Interfaces:**
- Consumes: `getDb()`, P2 types
- Produces: Full CRUD for each entity

- [ ] **Step 1: Write milestone CRUD**

Write `lib/db/milestones.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Milestone } from "@/lib/utils/types";

interface CreateMilestoneAttrs {
  track_id: string;
  title: string;
  description?: string;
  sort_order?: number;
}

export function createMilestone(attrs: CreateMilestoneAttrs): Milestone {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO milestones (id, track_id, title, description, sort_order, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, attrs.track_id, attrs.title, attrs.description || "", attrs.sort_order || 0, now);
  return db.prepare("SELECT * FROM milestones WHERE id = ?").get(id) as Milestone;
}

export function getMilestones(trackId: string): Milestone[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM milestones WHERE track_id = ? ORDER BY sort_order ASC"
  ).all(trackId) as Milestone[];
}

export function updateMilestone(id: string, attrs: { status?: string; completed_at?: string | null }): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE milestones SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}
```

- [ ] **Step 2: Write task CRUD**

Write `lib/db/tasks.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Task } from "@/lib/utils/types";

interface CreateTaskAttrs {
  milestone_id: string;
  title: string;
  what_to_do: string;
  how_hint?: string;
  difficulty?: number;
}

export function createTask(attrs: CreateTaskAttrs): Task {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO tasks (id, milestone_id, title, what_to_do, how_hint, difficulty, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(id, attrs.milestone_id, attrs.title, attrs.what_to_do, attrs.how_hint || "", attrs.difficulty || 1, now);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task;
}

export function getTasks(milestoneId: string): Task[] {
  const db = getDb();
  return db.prepare("SELECT * FROM tasks WHERE milestone_id = ? ORDER BY difficulty ASC, created_at ASC").all(milestoneId) as Task[];
}

export function getTask(id: string): Task | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return row ? (row as Task) : undefined;
}

export function toggleTaskDone(id: string): Task | null {
  const db = getDb();
  const task = getTask(id);
  if (!task) return null;
  const newStatus = task.status === "done" ? "pending" : "done";
  const completedAt = newStatus === "done" ? new Date().toISOString() : null;
  db.prepare("UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?").run(newStatus, completedAt, id);
  return getTask(id)!;
}

export function getTasksByProject(projectId: string): Task[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.* FROM tasks t
    JOIN milestones m ON t.milestone_id = m.id
    JOIN tracks tr ON m.track_id = tr.id
    WHERE tr.project_id = ? ORDER BY t.status ASC, t.difficulty ASC
  `).all(projectId) as Task[];
}
```

- [ ] **Step 3: Write check-in CRUD**

Write `lib/db/check-ins.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { CheckIn } from "@/lib/utils/types";

export function upsertCheckIn(projectId: string, summary: string): CheckIn {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const existing = db.prepare(
    "SELECT * FROM check_ins WHERE project_id = ? AND date = ?"
  ).get(projectId, today) as CheckIn | undefined;

  if (existing) {
    db.prepare("UPDATE check_ins SET summary = ? WHERE id = ?").run(summary, existing.id);
    return { ...existing, summary };
  }

  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    "INSERT INTO check_ins (id, project_id, date, summary, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, projectId, today, summary, now);
  return { id, project_id: projectId, date: today, summary, created_at: now };
}

export function getCheckIns(projectId: string): CheckIn[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM check_ins WHERE project_id = ? ORDER BY date ASC"
  ).all(projectId) as CheckIn[];
}

export function getStreak(projectId: string): { current: number; longest: number } {
  const checkIns = getCheckIns(projectId);
  const dates = new Set(checkIns.map(c => c.date));
  const today = new Date();

  // Count consecutive days backwards from today
  let current = 0;
  const d = new Date(today);
  while (dates.has(d.toISOString().slice(0, 10))) {
    current++;
    d.setDate(d.getDate() - 1);
  }

  // Find longest streak in history
  let longest = 0;
  let streak = 0;
  const sorted = [...dates].sort();
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { streak = 1; continue; }
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) { streak++; } else { streak = 1; }
    longest = Math.max(longest, streak);
  }
  longest = Math.max(longest, streak, current);

  return { current, longest };
}
```

- [ ] **Step 4: Write reflection CRUD**

Write `lib/db/reflections.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Reflection, ReflectionType } from "@/lib/utils/types";

interface CreateReflectionAttrs {
  project_id: string;
  type: ReflectionType;
  trigger_ref?: string | null;
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
}

export function createReflection(attrs: CreateReflectionAttrs): Reflection {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO reflections (id, project_id, type, trigger_ref, q1, q2, q3, q4, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, attrs.project_id, attrs.type, attrs.trigger_ref || null, attrs.q1 || "", attrs.q2 || "", attrs.q3 || "", attrs.q4 || "", now);
  return db.prepare("SELECT * FROM reflections WHERE id = ?").get(id) as Reflection;
}

export function getReflections(projectId: string): Reflection[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM reflections WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId) as Reflection[];
}
```

- [ ] **Step 5: Write project log CRUD**

Write `lib/db/project-logs.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { ProjectLog } from "@/lib/utils/types";

export function addLog(projectId: string, action: string, detail: string): ProjectLog {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    "INSERT INTO project_logs (id, project_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, projectId, action, detail, now);
  return { id, project_id: projectId, action, detail, created_at: now };
}

export function getRecentLogs(projectId: string, limit: number = 3): ProjectLog[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(projectId, limit) as ProjectLog[];
}

export function getLogsByProject(projectId: string): ProjectLog[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId) as ProjectLog[];
}
```

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit
git add lib/db/milestones.ts lib/db/tasks.ts lib/db/check-ins.ts lib/db/reflections.ts lib/db/project-logs.ts
git commit -m "feat: add milestone, task, check-in, reflection and project log CRUD

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Project Decomposer Engine

**Files:**
- Create: `lib/engine/project-decomposer.ts`

**Interfaces:**
- Consumes: `routeModel("dialogue")` from `lib/models/router`, `getAgeConfig` from `lib/utils/age-config`, `SolutionPack` type, `buildSystemPrompt` from `lib/prompts/system-prompt`
- Produces: `decomposeSolutionPack(sessionId, ageGroup) → DecomposedProject | null`

- [ ] **Step 1: Write project decomposer**

Write `lib/engine/project-decomposer.ts`:

```typescript
import type { AgeGroup, SolutionPack } from "@/lib/utils/types";
import { getSolutionPacks } from "@/lib/db/solution-packs";
import { routeModel } from "@/lib/models/router";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";
import { getAgeConfig } from "@/lib/utils/age-config";

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
  const config = getAgeConfig(ageGroup);
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
      temperature: 0.3,
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
  const { getDb } = require("@/lib/db/index");
  const db = getDb();
  return db.prepare(
    "SELECT * FROM solution_packs WHERE session_id = ? ORDER BY version DESC"
  ).all(sessionId) as SolutionPack[];
}
```

**Important:** Replace the `require()` call at the bottom with a proper import. At the top of the file, add:
```typescript
import { getDb } from "@/lib/db/index";
```
Then replace the `getSolutionPacks` helper function body with:
```typescript
function getSolutionPacks(sessionId: string): SolutionPack[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM solution_packs WHERE session_id = ? ORDER BY version DESC"
  ).all(sessionId) as SolutionPack[];
}
```

- [ ] **Step 2: Commit**

```bash
npx tsc --noEmit
git add lib/engine/project-decomposer.ts
git commit -m "feat: add project decomposer engine with AI-powered solution pack breakdown

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Resume Builder & Reflection Coach Engines

**Files:**
- Create: `lib/engine/resume-builder.ts`
- Create: `lib/engine/reflection-coach.ts`

**Interfaces:**
- Consumes: `routeModel`, `getAgeConfig`, `buildSystemPrompt`, P2 types
- Produces: `buildResumePrompt(project)` → text, `buildReflectionQuestions(project, type, triggerRef)` → { questions, contextNote }

- [ ] **Step 1: Write resume builder**

Write `lib/engine/resume-builder.ts`:

```typescript
import type { AgeGroup, Project, Task } from "@/lib/utils/types";
import { getRecentLogs } from "@/lib/db/project-logs";
import { getCheckIns, getStreak } from "@/lib/db/check-ins";
import { getTasksByProject } from "@/lib/db/tasks";
import { routeModel } from "@/lib/models/router";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";
import { getAgeConfig } from "@/lib/utils/age-config";

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

  const config = getAgeConfig(ageGroup);
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
```

- [ ] **Step 2: Write reflection coach**

Write `lib/engine/reflection-coach.ts`:

```typescript
import type { AgeGroup, Project, ReflectionType } from "@/lib/utils/types";
import { getRecentLogs } from "@/lib/db/project-logs";
import { getMilestones } from "@/lib/db/milestones";
import { getTracks } from "@/lib/db/tracks";
import { getTasks } from "@/lib/db/tasks";

export interface ReflectionQuestion {
  id: string;
  text: string;
  hint: string;
}

export interface ReflectionQuestions {
  questions: ReflectionQuestion[];
  context_note: string;
}

export async function buildReflectionQuestions(
  project: Project,
  ageGroup: AgeGroup,
  type: ReflectionType,
  triggerRef?: string | null
): Promise<ReflectionQuestions> {
  const logs = getRecentLogs(project.id, 5);
  const tracks = getTracks(project.id);

  // Build context from recent activity
  const doneTasks = logs.filter(l => l.action === "task_done").map(l => l.detail).slice(0, 3);
  const contextNote = doneTasks.length > 0
    ? `完成了：${doneTasks.join("、")}`
    : "";

  const isYoung = ageGroup === "6-9";

  const questions: ReflectionQuestion[] = [
    {
      id: "q1",
      text: isYoung
        ? `今天你做了什么呀？`
        : type === "daily"
          ? "今天你完成了哪些事情？"
          : type === "milestone"
            ? "这个阶段你完成了哪些事情？"
            : "整个项目你完成了哪些事情？回顾一下旅程吧。",
      hint: "想想今天完成了什么任务",
    },
    {
      id: "q2",
      text: isYoung
        ? "有什么让你觉得难的吗？"
        : "过程中遇到的最大挑战是什么？你是怎么解决的？",
      hint: "可以是技术上、材料上、或者时间上的困难",
    },
    {
      id: "q3",
      text: isYoung
        ? "你学会了什么新本领？"
        : type === "daily"
          ? "今天学到了什么新东西？"
          : "你学到了什么新知识或技能？如果可以重来，会怎么做？",
      hint: "可以是具体的技能，也可以是对自己的发现",
    },
    {
      id: "q4",
      text: isYoung
        ? "接下来想做什么呀？"
        : "下一步你有什么计划？需要什么帮助？",
      hint: type === "final" ? "这个项目结束后，你下一步的目标是什么？" : "下一个任务或目标是什么",
    },
  ];

  return { questions, context_note: contextNote };
}
```

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit
git add lib/engine/resume-builder.ts lib/engine/reflection-coach.ts
git commit -m "feat: add resume builder and reflection coach engines

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Core Project API Routes

**Files:**
- Create: `app/api/projects/route.ts`
- Create: `app/api/projects/[id]/route.ts`
- Create: `app/api/projects/[id]/tracks/route.ts`

**Interfaces:**
- Consumes: DB CRUD modules, decomposer engine
- Produces: `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/[id]`, `POST/DELETE /api/projects/[id]/tracks`

- [ ] **Step 1: Write project list/create route**

Write `app/api/projects/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db/projects";
import { createTrack } from "@/lib/db/tracks";
import { createMilestone } from "@/lib/db/milestones";
import { createTask } from "@/lib/db/tasks";
import { addLog } from "@/lib/db/project-logs";
import { decomposeSolutionPack } from "@/lib/engine/project-decomposer";
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

  addLog(project.id, "task_done", "项目创建成功");

  return NextResponse.json({ project: { ...project, tracks: decomposed.tracks } }, { status: 201 });
}
```

- [ ] **Step 2: Write project detail route**

Write `app/api/projects/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject, deleteProject } from "@/lib/db/projects";
import { getTracks } from "@/lib/db/tracks";
import { getMilestones } from "@/lib/db/milestones";
import { getTasks } from "@/lib/db/tasks";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const tracks = getTracks(project.id);
  const tracksWithData = tracks.map(t => {
    const milestones = getMilestones(t.id).map(m => ({
      ...m,
      tasks: getTasks(m.id),
    }));
    return { ...t, milestones };
  });

  return NextResponse.json({ project: { ...project, tracks: tracksWithData } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const body = await req.json() as { title?: string; status?: string };
  updateProject(params.id, body);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  deleteProject(params.id);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Write tracks sub-route**

Write `app/api/projects/[id]/tracks/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { createTrack, getTracks, deleteTrack } from "@/lib/db/tracks";
import type { TrackType } from "@/lib/utils/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ tracks: getTracks(params.id) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const { name, type } = await req.json() as { name: string; type: TrackType };
  const track = createTrack({ project_id: params.id, name, type });
  return NextResponse.json({ track }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const trackId = req.nextUrl.searchParams.get("trackId");
  if (!trackId) {
    return NextResponse.json({ error: "缺少 trackId" }, { status: 400 });
  }
  deleteTrack(trackId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
npx tsc --noEmit && npm run build
git add app/api/projects/
git commit -m "feat: add core project API routes (list, create, detail, tracks)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Task, Check-in, Reflection & Resume API Routes

**Files:**
- Create: `app/api/tasks/[id]/done/route.ts`
- Create: `app/api/projects/[id]/check-in/route.ts`
- Create: `app/api/projects/[id]/reflect/route.ts`
- Create: `app/api/projects/[id]/resume/route.ts`

**Interfaces:**
- Consumes: Task/check-in/reflection CRUD, resume-builder, reflection-coach
- Produces: 4 API endpoints

- [ ] **Step 1: Write task toggle route**

Write `app/api/tasks/[id]/done/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { toggleTaskDone, getTask } from "@/lib/db/tasks";
import { updateMilestone } from "@/lib/db/milestones";
import { addLog } from "@/lib/db/project-logs";
import { getDb } from "@/lib/db/index";

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
```

- [ ] **Step 2: Write check-in route**

Write `app/api/projects/[id]/check-in/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { upsertCheckIn, getCheckIns, getStreak } from "@/lib/db/check-ins";
import { addLog } from "@/lib/db/project-logs";
import { getProject } from "@/lib/db/projects";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    check_ins: getCheckIns(params.id),
    streak: getStreak(params.id),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const { summary } = await req.json() as { summary: string };
  if (!summary) {
    return NextResponse.json({ error: "请输入今日总结" }, { status: 400 });
  }
  const checkIn = upsertCheckIn(params.id, summary);
  addLog(params.id, "check_in", summary.slice(0, 100));
  const streak = getStreak(params.id);
  return NextResponse.json({ check_in: checkIn, streak });
}
```

- [ ] **Step 3: Write reflection route**

Write `app/api/projects/[id]/reflect/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { createReflection, getReflections } from "@/lib/db/reflections";
import { addLog } from "@/lib/db/project-logs";
import { buildReflectionQuestions } from "@/lib/engine/reflection-coach";
import type { AgeGroup, ReflectionType } from "@/lib/utils/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ reflections: getReflections(params.id) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const { type, trigger_ref, q1, q2, q3, q4, ageGroup } = await req.json() as {
    type: ReflectionType;
    trigger_ref?: string;
    q1?: string;
    q2?: string;
    q3?: string;
    q4?: string;
    ageGroup?: AgeGroup;
  };

  // If q1 is not provided, we're requesting questions (not submitting answers)
  if (!q1 && !q2 && !q3 && !q4) {
    const { questions, context_note } = await buildReflectionQuestions(
      project,
      ageGroup || "10-12",
      type,
      trigger_ref || null
    );
    return NextResponse.json({ questions, context_note });
  }

  // Submit answers
  const reflection = createReflection({
    project_id: params.id,
    type,
    trigger_ref: trigger_ref || null,
    q1: q1 || "",
    q2: q2 || "",
    q3: q3 || "",
    q4: q4 || "",
  });

  addLog(params.id, "reflection", `${type}复盘`);

  return NextResponse.json({ reflection }, { status: 201 });
}
```

- [ ] **Step 4: Write resume route**

Write `app/api/projects/[id]/resume/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { buildResume } from "@/lib/engine/resume-builder";
import type { AgeGroup } from "@/lib/utils/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const ageGroup = (req.nextUrl.searchParams.get("ageGroup") || "10-12") as AgeGroup;
  const resume = await buildResume(project, ageGroup);
  return NextResponse.json(resume);
}
```

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit && npm run build
git add app/api/tasks/ app/api/projects/\[id\]/check-in/ app/api/projects/\[id\]/reflect/ app/api/projects/\[id\]/resume/
git commit -m "feat: add task, check-in, reflection and resume API routes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Project Zustand Store

**Files:**
- Create: `lib/store/project-store.ts`

**Interfaces:**
- Consumes: P2 types
- Produces: `useProjectStore` — Zustand store for project list + detail state

- [ ] **Step 1: Write project store**

Write `lib/store/project-store.ts`:

```typescript
import { create } from "zustand";
import type { Project, Track, CheckIn, Reflection } from "@/lib/utils/types";

interface ProjectState {
  projects: Project[];
  currentProject: (Project & { tracks: Track[] }) | null;
  checkIns: CheckIn[];
  reflections: Reflection[];
  streak: { current: number; longest: number };

  // Actions
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (p: (Project & { tracks: Track[] }) | null) => void;
  setCheckIns: (c: CheckIn[]) => void;
  setReflections: (r: Reflection[]) => void;
  setStreak: (s: { current: number; longest: number }) => void;
  updateTaskStatus: (taskId: string, status: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  checkIns: [],
  reflections: [],
  streak: { current: 0, longest: 0 },

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (p) => set({ currentProject: p }),
  setCheckIns: (c) => set({ checkIns: c }),
  setReflections: (r) => set({ reflections: r }),
  setStreak: (s) => set({ streak: s }),

  updateTaskStatus: (taskId, status) =>
    set((s) => {
      if (!s.currentProject) return s;
      return {
        currentProject: {
          ...s.currentProject,
          tracks: s.currentProject.tracks.map((t) => ({
            ...t,
            milestones: (t as Track & { milestones: Array<{ id: string; tasks: Array<{ id: string; status: string }> }> }).milestones.map((m) => ({
              ...m,
              tasks: m.tasks.map((tk) =>
                tk.id === taskId ? { ...tk, status } : tk
              ),
            })),
          })),
        },
      };
    }),
}));
```

- [ ] **Step 2: Commit**

```bash
npx tsc --noEmit
git add lib/store/project-store.ts
git commit -m "feat: add Zustand project store for P2 state management

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Project List Page

**Files:**
- Create: `app/projects/page.tsx`
- Create: `components/projects/project-card.tsx`

**Interfaces:**
- Consumes: `useProjectStore`, `/api/projects`
- Produces: Project list page at `/projects`

- [ ] **Step 1: Write project card**

Write `components/projects/project-card.tsx`:

```typescript
"use client";

import Link from "next/link";
import type { Project } from "@/lib/utils/types";

interface Props {
  project: Project;
}

export function ProjectCard({ project }: Props) {
  const statusLabel =
    project.status === "active" ? "进行中" :
    project.status === "paused" ? "已暂停" : "已完成";
  const statusColor =
    project.status === "active" ? "bg-accent-green/10 text-accent-green" :
    project.status === "paused" ? "bg-brand-soft text-[#B26A00]" :
    "bg-surface-raised text-ink-tertiary";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block bg-surface border border-border rounded-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-body-lg">{project.title}</h3>
        <span className={`text-xs rounded-full px-2.5 py-1 font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-center gap-2 text-body-sm text-ink-tertiary">
        <span>上次活动：{new Date(project.updated_at).toLocaleDateString("zh-CN")}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Write project list page**

Write `app/projects/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProjectCard } from "@/components/projects/project-card";
import type { Project } from "@/lib/utils/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">🚀 我的项目</h1>
      </div>

      {loading && (
        <div className="text-center py-12 text-ink-tertiary">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>加载中……</p>
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-body-lg text-ink-tertiary">还没有项目</p>
          <p className="text-body-sm text-ink-tertiary mt-2">
            先在首页完成一次方案包生成，然后点击"开始项目"即可创建
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-primary hover:underline text-body"
          >
            回到首页 →
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit && npm run build
git add app/projects/page.tsx components/projects/project-card.tsx
git commit -m "feat: add project list page with project cards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Project Detail Page (Hero + Track Columns + Task Cards)

**Files:**
- Create: `app/projects/[id]/page.tsx`
- Create: `components/projects/project-hero.tsx`
- Create: `components/projects/track-column.tsx`
- Create: `components/projects/task-card.tsx`

**Interfaces:**
- Consumes: `useProjectStore`, `/api/projects/[id]`, `/api/projects/[id]/resume`
- Produces: Full project detail page

- [ ] **Step 1: Write project hero (resume block)**

Write `components/projects/project-hero.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";

interface Props {
  projectId: string;
  ageGroup?: string;
}

export function ProjectHero({ projectId, ageGroup }: Props) {
  const [resumeText, setResumeText] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/resume?ageGroup=${ageGroup || "10-12"}`)
      .then(r => r.json())
      .then(d => setResumeText(d.resume_text || ""))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, ageGroup]);

  if (loading) return null;

  return (
    <div className="bg-bubble-guide border border-border rounded-card px-5 py-4 mb-6">
      <div className="flex gap-3">
        <span className="text-lg">💬</span>
        <p className="text-body whitespace-pre-wrap">{resumeText}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write task card**

Write `components/projects/task-card.tsx`:

```typescript
"use client";

interface Props {
  taskId: string;
  title: string;
  whatToDo: string;
  howHint: string;
  difficulty: number;
  status: string;
  onToggle: (taskId: string) => void;
}

export function TaskCard({ taskId, title, whatToDo, howHint, difficulty, status, onToggle }: Props) {
  const isDone = status === "done";
  const diffColor =
    difficulty === 1 ? "bg-accent-green/10 text-accent-green" :
    difficulty === 2 ? "bg-brand-soft text-[#B26A00]" :
    "bg-[#FF6B6B]/10 text-[#FF6B6B]";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-btn border transition-all ${
      isDone ? "border-accent-green/30 bg-accent-green/5" : "border-border bg-white hover:shadow-sm"
    }`}>
      <button
        onClick={() => onToggle(taskId)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
          isDone
            ? "bg-accent-green border-accent-green text-white"
            : "border-ink-tertiary/30 hover:border-primary"
        }`}
      >
        {isDone && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium text-body-sm ${isDone ? "line-through text-ink-tertiary" : "text-ink"}`}>
            {title}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${diffColor}`}>
            {"⭐".repeat(difficulty)}
          </span>
        </div>
        <p className="text-body-sm text-ink-tertiary">{whatToDo}</p>
        {howHint && !isDone && (
          <p className="text-caption text-primary mt-1">💡 {howHint}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write track column**

Write `components/projects/track-column.tsx`:

```typescript
"use client";

import { TaskCard } from "./task-card";

interface TrackData {
  id: string;
  name: string;
  type: string;
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    tasks: Array<{
      id: string;
      title: string;
      what_to_do: string;
      how_hint: string;
      difficulty: number;
      status: string;
    }>;
  }>;
}

interface Props {
  track: TrackData;
  onTaskToggle: (taskId: string) => void;
}

export function TrackColumn({ track, onTaskToggle }: Props) {
  const totalTasks = track.milestones.flatMap(m => m.tasks).length;
  const doneTasks = track.milestones.flatMap(m => m.tasks).filter(t => t.status === "done").length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const trackIcon = track.type === "software" ? "🖥" : "🔧";

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-body">
            {trackIcon} {track.name}
          </h3>
          <span className="text-body-sm text-ink-tertiary">{doneTasks}/{totalTasks}</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Milestones */}
      <div className="p-4 space-y-4">
        {track.milestones.map(m => (
          <div key={m.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                m.status === "done"
                  ? "bg-accent-green/10 text-accent-green"
                  : "bg-surface-raised text-ink-tertiary"
              }`}>
                {m.status === "done" ? "✅" : "○"} {m.title}
              </span>
            </div>
            <div className="space-y-2 pl-2">
              {m.tasks.map(t => (
                <TaskCard
                  key={t.id}
                  taskId={t.id}
                  title={t.title}
                  whatToDo={t.what_to_do}
                  howHint={t.how_hint}
                  difficulty={t.difficulty}
                  status={t.status}
                  onToggle={onTaskToggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write project detail page**

Write `app/projects/[id]/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProjectHero } from "@/components/projects/project-hero";
import { TrackColumn } from "@/components/projects/track-column";
import { useChatStore } from "@/lib/store/chat-store";

interface ProjectData {
  id: string;
  title: string;
  status: string;
  tracks: Array<{
    id: string;
    name: string;
    type: string;
    milestones: Array<{
      id: string;
      title: string;
      status: string;
      tasks: Array<{
        id: string;
        title: string;
        what_to_do: string;
        how_hint: string;
        difficulty: number;
        status: string;
      }>;
    }>;
  }>;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const ageGroup = useChatStore(s => s.ageGroup);

  const fetchProject = () => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(d => setProject(d.project))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProject(); }, [id]);

  const handleTaskToggle = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}/done`, { method: "POST" });
    const data = await res.json();
    if (data.task) {
      // Optimistic update: toggle locally
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tracks: prev.tracks.map(t => ({
            ...t,
            milestones: t.milestones.map(m => ({
              ...m,
              tasks: m.tasks.map(tk =>
                tk.id === taskId ? { ...tk, status: data.task.status } : tk
              ),
            })),
          })),
        };
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-body-lg text-ink-tertiary">项目不存在</p>
        <Link href="/projects" className="text-primary hover:underline mt-4 inline-block">返回项目列表</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回项目列表
        </Link>
        <h1 className="text-2xl font-bold">{project.title}</h1>
      </div>

      <ProjectHero projectId={id} ageGroup={ageGroup} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {project.tracks.map(t => (
          <TrackColumn key={t.id} track={t} onTaskToggle={handleTaskToggle} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit && npm run build
git add app/projects/\[id\]/page.tsx components/projects/project-hero.tsx components/projects/track-column.tsx components/projects/task-card.tsx
git commit -m "feat: add project detail page with hero, track columns and task cards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Calendar Heatmap, Streak Badge & Check-in Dialog

**Files:**
- Create: `components/projects/calendar-heatmap.tsx`
- Create: `components/projects/streak-badge.tsx`
- Create: `components/projects/check-in-dialog.tsx`

**Interfaces:**
- Consumes: `/api/projects/[id]/check-in`
- Produces: Three reusable components

- [ ] **Step 1: Write calendar heatmap**

Write `components/projects/calendar-heatmap.tsx`:

```typescript
"use client";

import type { CheckIn } from "@/lib/utils/types";

interface Props {
  checkIns: CheckIn[];
}

export function CalendarHeatmap({ checkIns }: Props) {
  const dates = new Set(checkIns.map(c => c.date));

  // Generate last 4 weeks grid
  const weeks: Array<Array<{ date: string; day: number; checked: boolean }>> = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 27); // 4 weeks back

  let currentWeek: Array<{ date: string; day: number; checked: boolean }> = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    currentWeek.push({ date: dateStr, day: d.getDay(), checked: dates.has(dateStr) });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div className="flex gap-1">
      {/* Day labels */}
      <div className="flex flex-col gap-1 mr-1">
        {dayLabels.map((l, i) => (
          <span key={i} className="text-[10px] text-ink-tertiary leading-4 w-5 text-right">{l}</span>
        ))}
      </div>
      {/* Grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((cell, ci) => (
            <div
              key={ci}
              title={`${cell.date}${cell.checked ? " ✓" : ""}`}
              className={`w-4 h-4 rounded-sm ${
                cell.checked ? "bg-primary" : "bg-surface-raised"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write streak badge**

Write `components/projects/streak-badge.tsx`:

```typescript
"use client";

interface Props {
  current: number;
  longest: number;
}

export function StreakBadge({ current, longest }: Props) {
  const badge =
    current >= 30 ? "🏆" :
    current >= 14 ? "💎" :
    current >= 7 ? "🌟" :
    current >= 3 ? "🔥" : "";

  const message =
    current >= 30 ? "超级坚持！连续 30 天！" :
    current >= 14 ? "两周了！你太厉害了！" :
    current >= 7 ? "连续一周打卡！" :
    current >= 3 ? "连续 3 天！保持！" :
    current > 0 ? `连续 ${current} 天打卡` : "今天开始打卡吧！";

  return (
    <div className="flex items-center gap-2 text-body-sm">
      {badge && <span className="text-xl animate-bounce">{badge}</span>}
      <span className="text-ink-secondary">{message}</span>
      <span className="text-ink-tertiary">（最长 {longest} 天）</span>
    </div>
  );
}
```

- [ ] **Step 3: Write check-in dialog**

Write `components/projects/check-in-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";

interface Props {
  projectId: string;
  onDone: () => void;
  onClose: () => void;
}

export function CheckInDialog({ projectId, onDone, onClose }: Props) {
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!summary.trim()) return;
    setSubmitting(true);
    await fetch(`/api/projects/${projectId}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: summary.trim() }),
    });
    setSubmitting(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4">
        <h3 className="text-body-lg font-bold mb-4">📝 今日总结</h3>
        <p className="text-body-sm text-ink-tertiary mb-3">
          今天在这个项目上做了什么？
        </p>
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          className="w-full bg-surface-raised border border-border rounded-btn px-4 py-3 text-body resize-none min-h-[100px] focus:border-primary focus:outline-none"
          placeholder="比如：写完了水泵控制代码，测试了一下可以正常开关……"
          autoFocus
        />
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-body-sm text-ink-tertiary hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!summary.trim() || submitting}
            className="bg-primary text-white border-none rounded-btn px-5 py-2 font-semibold text-body-sm disabled:opacity-40"
          >
            {submitting ? "保存中……" : "完成打卡"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
npx tsc --noEmit && npm run build
git add components/projects/calendar-heatmap.tsx components/projects/streak-badge.tsx components/projects/check-in-dialog.tsx
git commit -m "feat: add calendar heatmap, streak badge and check-in dialog

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Reflection Dialog & P1→P2 Wiring

**Files:**
- Create: `components/projects/reflection-dialog.tsx`
- Modify: `components/panels/solution-preview.tsx`

**Interfaces:**
- Consumes: `/api/projects/[id]/reflect`, `useChatStore`
- Produces: Reflection dialog, "开始项目" button in solution preview

- [ ] **Step 1: Write reflection dialog**

Write `components/projects/reflection-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { ReflectionType } from "@/lib/utils/types";

interface Question {
  id: string;
  text: string;
  hint: string;
}

interface Props {
  projectId: string;
  type: ReflectionType;
  triggerRef?: string;
  onDone: () => void;
  onClose: () => void;
}

export function ReflectionDialog({ projectId, type, triggerRef, onDone, onClose }: Props) {
  const [step, setStep] = useState(0); // 0=loading questions, 1-4=q1-q4, 5=done
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contextNote, setContextNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load questions on mount
  useState(() => {
    fetch(`/api/projects/${projectId}/reflect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, trigger_ref: triggerRef || null }),
    })
      .then(r => r.json())
      .then(d => {
        setQuestions(d.questions || []);
        setContextNote(d.context_note || "");
        setStep(1);
      })
      .catch(() => setStep(1));
  });

  const handleNext = (qId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [qId]: answer }));
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSubmit({ ...answers, [qId]: answer });
    }
  };

  const handleSubmit = async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);
    await fetch(`/api/projects/${projectId}/reflect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        trigger_ref: triggerRef || null,
        q1: finalAnswers.q1 || "",
        q2: finalAnswers.q2 || "",
        q3: finalAnswers.q3 || "",
        q4: finalAnswers.q4 || "",
      }),
    });
    setSubmitting(false);
    setStep(5);
  };

  const handleSkip = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSubmit(answers);
    }
  };

  if (step === 0) {
    return (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
        <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4 text-center">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-body text-ink-tertiary">准备复盘问题……</p>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
        <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-body-lg font-bold mb-2">复盘完成！</h3>
          <p className="text-body-sm text-ink-tertiary mb-4">你的成长记录已保存</p>
          <button
            onClick={onDone}
            className="bg-primary text-white border-none rounded-btn px-6 py-2.5 font-semibold"
          >
            知道了
          </button>
        </div>
      </div>
    );
  }

  const q = questions[step - 1];
  if (!q) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-body-sm text-ink-tertiary">
            {step}/{questions.length}
          </span>
          <div className="flex-1 h-1 bg-surface-raised rounded-full">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(step / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {contextNote && step === 1 && (
          <p className="text-body-sm text-ink-tertiary mb-4">{contextNote}</p>
        )}

        <h3 className="text-body-lg font-bold mb-3">{q.text}</h3>
        {q.hint && <p className="text-body-sm text-ink-tertiary mb-4">💡 {q.hint}</p>}

        <textarea
          className="w-full bg-surface-raised border border-border rounded-btn px-4 py-3 text-body resize-none min-h-[80px] focus:border-primary focus:outline-none"
          placeholder="写下你的想法……"
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleNext(q.id, (e.target as HTMLTextAreaElement).value);
            }
          }}
        />

        <div className="flex gap-3 mt-4 justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-body-sm text-ink-tertiary hover:text-ink transition-colors"
          >
            跳过
          </button>
          <button
            onClick={() => {
              const ta = document.querySelector("textarea") as HTMLTextAreaElement;
              handleNext(q.id, ta?.value || "");
            }}
            disabled={submitting}
            className="bg-primary text-white border-none rounded-btn px-5 py-2 font-semibold text-body-sm disabled:opacity-40"
          >
            {step === 4 ? (submitting ? "保存中……" : "完成") : "下一题"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add "开始项目" button to solution preview**

In `components/panels/solution-preview.tsx`, add after the existing button block (before the closing tag of the main div). Add this button alongside the existing "复制" functionality. Locate the section after the pack is rendered and add a project creation button:

Find the section where the pack content is displayed and add after the copy button section:

```typescript
// Add this import at top:
import { useRouter } from "next/navigation";

// Add inside the component:
const router = useRouter();

// Add "开始项目" button in the confirmed state section, next to the copy button:
const handleStartProject = async () => {
  if (!sessionId) return;
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, ageGroup: "10-12" }),
  });
  const data = await res.json();
  if (data.project) {
    router.push(`/projects/${data.project.id}`);
  }
};
```

Add this button near where `solutionPack` is displayed and `solutionStatus === "ready"`:

```tsx
<button
  onClick={handleStartProject}
  className="mt-3 w-full bg-accent-green text-white border-none rounded-btn px-4 py-2.5 font-semibold hover:opacity-90 transition-opacity"
>
  🚀 开始项目
</button>
```

Note: The exact insertion point depends on the current structure of solution-preview.tsx. The implementer must read the file first and insert the button in a sensible location (after solution pack content display, before closing tags).

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit && npm run build
git add components/projects/reflection-dialog.tsx components/panels/solution-preview.tsx
git commit -m "feat: add reflection dialog and P1-to-P2 wiring (start project button)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Integration & Polish

**Files:**
- Modify: `DEVELOPMENT.md`
- Modify: `app/projects/[id]/page.tsx` — add check-in/reflection buttons + calendar/streak
- Modify: `app/page.tsx` — add projects link to nav

**Interfaces:**
- All modules wired; full user flow verified

- [ ] **Step 1: Add check-in, reflection, calendar to project detail page**

In `app/projects/[id]/page.tsx`, add below the track grid:

```tsx
import { useState } from "react";
import { CalendarHeatmap } from "@/components/projects/calendar-heatmap";
import { StreakBadge } from "@/components/projects/streak-badge";
import { CheckInDialog } from "@/components/projects/check-in-dialog";
import { ReflectionDialog } from "@/components/projects/reflection-dialog";
import type { CheckIn, ReflectionType } from "@/lib/utils/types";

// Add state in component:
const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
const [streak, setStreak] = useState({ current: 0, longest: 0 });
const [showCheckIn, setShowCheckIn] = useState(false);
const [showReflection, setShowReflection] = useState(false);
const [reflectionType, setReflectionType] = useState<ReflectionType>("daily");

// Add fetch after project load:
useEffect(() => {
  fetch(`/api/projects/${id}/check-in`)
    .then(r => r.json())
    .then(d => { setCheckIns(d.check_ins || []); setStreak(d.streak || { current: 0, longest: 0 }); })
    .catch(console.error);
}, [id]);
```

Add below the track grid in JSX:

```tsx
{/* Check-in & Reflection bar */}
<div className="mt-6 flex flex-wrap items-center gap-3">
  <button
    onClick={() => setShowCheckIn(true)}
    className="bg-primary text-white border-none rounded-btn px-4 py-2 font-semibold text-body-sm"
  >
    📝 每日总结
  </button>
  <button
    onClick={() => { setReflectionType("daily"); setShowReflection(true); }}
    className="bg-surface border border-border rounded-btn px-4 py-2 font-medium text-body-sm hover:bg-surface-raised transition-colors"
  >
    💭 每日复盘
  </button>
  <button
    onClick={() => { setReflectionType("milestone"); setShowReflection(true); }}
    className="bg-surface border border-border rounded-btn px-4 py-2 font-medium text-body-sm hover:bg-surface-raised transition-colors"
  >
    🏔 里程碑复盘
  </button>
  <button
    onClick={() => { setReflectionType("final"); setShowReflection(true); }}
    className="bg-surface border border-border rounded-btn px-4 py-2 font-medium text-body-sm hover:bg-surface-raised transition-colors"
  >
    🎯 总复盘
  </button>
</div>

{/* Calendar and streak */}
<div className="mt-6 bg-surface border border-border rounded-card p-5">
  <h3 className="font-semibold text-body mb-3">📅 打卡记录</h3>
  <CalendarHeatmap checkIns={checkIns} />
  <div className="mt-3">
    <StreakBadge current={streak.current} longest={streak.longest} />
  </div>
</div>

{/* Dialogs */}
{showCheckIn && (
  <CheckInDialog
    projectId={id}
    onDone={() => {
      setShowCheckIn(false);
      fetch(`/api/projects/${id}/check-in`)
        .then(r => r.json())
        .then(d => { setCheckIns(d.check_ins || []); setStreak(d.streak || { current: 0, longest: 0 }); })
        .catch(console.error);
    }}
    onClose={() => setShowCheckIn(false)}
  />
)}
{showReflection && (
  <ReflectionDialog
    projectId={id}
    type={reflectionType}
    onDone={() => {
      setShowReflection(false);
    }}
    onClose={() => setShowReflection(false)}
  />
)}
```

- [ ] **Step 2: Add projects link to main nav**

In `app/page.tsx`, add a "项目" link next to the settings link in the header:

```tsx
<Link
  href="/projects"
  className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
>
  🚀 项目
</Link>
```

- [ ] **Step 3: Update DEVELOPMENT.md**

Update P2 progress:

```markdown
## P2 · 项目工坊（目标：2026-08-22）
- [x] Task 1: P2 类型与数据库扩展
- [x] Task 2: 项目与轨道 CRUD
- [x] Task 3: 里程碑/任务/打卡/复盘/日志 CRUD
- [x] Task 4: 项目拆解引擎
- [x] Task 5: 续接与复盘教练引擎
- [x] Task 6: 核心项目 API
- [x] Task 7: 任务/打卡/复盘/续接 API
- [x] Task 8: 项目 Zustand Store
- [x] Task 9: 项目列表页
- [x] Task 10: 项目详情页
- [x] Task 11: 日历热力图/徽章/打卡弹窗
- [x] Task 12: 复盘弹窗与 P1→P2 衔接
- [x] Task 13: 集成联调
```

Update overall progress: `P1 ✅ | P2 ██████████ 100% | P3-P6 未开始`

- [ ] **Step 4: Full build verification**

```bash
npx tsc --noEmit && npm run build
# Verify routes: /projects, /projects/[id], /api/projects, /api/tasks/*, etc.
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete P2 project studio — full project lifecycle working

P2 delivers: project CRUD, multi-track milestone system, task check-in,
daily summaries, 3-tier reflection, smart resume, AI decomposition engine.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

*计划结束。*
