# P4 家长控制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a parent dashboard with usage controls, project management, data panel, and system logs

**Architecture:** 3 new DB tables (usage_config, usage_log, filtered_words) + 1 enum extension (archived), 10 API routes, 1 page at `/parent` with 4 tabs, model config migrated from `/settings`

**Tech Stack:** Next.js 14 App Router + TypeScript strict + Tailwind CSS v3 + Zustand v5 + better-sqlite3

## Global Constraints

- Zero new npm deps — everything must use existing stack
- "use client" page for /parent
- Tailwind CSS only (no CSS modules or inline styles)
- Follow existing API route patterns (simple handler functions, no middleware)
- Follow existing DB patterns (v4 uuid, getDb() singleton, prepared statements)
- Copy strings must match spec exactly
- New tables added to the existing `db.exec()` block in `lib/db/index.ts`
- All API routes follow the existing pattern: JSON in/out, no streaming for parent APIs

---

### Task 1: P4 类型与数据库扩展

**Files:**
- Modify: `lib/utils/types.ts` (append after Badge interface)
- Modify: `lib/db/index.ts` (append before existing CREATE INDEX lines, after badges table)

**Interfaces:**
- Produces: `UsageConfig`, `UsageLog`, `FilteredWord` types; 3 new tables + indexes

- [ ] **Step 1: Add P4 types to lib/utils/types.ts**

```typescript
export interface UsageConfig {
  id: number; // always 1
  daily_limit_min: number | null;
  quiet_start: string | null; // HH:mm
  quiet_end: string | null;
  filter_enabled: number; // 0/1
  restrictions_paused: number; // 0/1
  updated_at: string;
}

export interface UsageLog {
  id: string;
  date: string; // YYYY-MM-DD
  total_sec: number;
}

export interface FilteredWord {
  id: number;
  word: string;
}
```

- [ ] **Step 2: Add P4 tables to lib/db/index.ts**

After the badges table block (line 191) and before the existing indexes, append:

```sql
CREATE TABLE IF NOT EXISTS usage_config (
  id                  INTEGER PRIMARY KEY CHECK(id = 1),
  daily_limit_min     INTEGER,
  quiet_start         TEXT,
  quiet_end           TEXT,
  filter_enabled      INTEGER DEFAULT 0,
  restrictions_paused INTEGER DEFAULT 0,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_log (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  total_sec   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS filtered_words (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE
);
```

After the existing indexes, add:

```sql
CREATE INDEX IF NOT EXISTS idx_usage_log_date ON usage_log(date);
```

- [ ] **Step 3: Seed default data**

In the same `db.exec()` block, add after table creation:

```sql
INSERT OR IGNORE INTO usage_config (id) VALUES (1);
```

And seed 20 default filtered words:

```sql
INSERT OR IGNORE INTO filtered_words (word) VALUES
('暴力'),('自杀'),('自残'),('毒品'),('色情'),('赌博'),
('恐怖主义'),('种族歧视'),('虐待'),('枪支'),
('炸弹'),('炸药'),('毒药'),('酗酒'),('吸烟'),
('诈骗'),('黑客'),('盗版'),('欺凌'),('裸体');
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: successful build, new tables created on next startup.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/types.ts lib/db/index.ts
git commit -m "feat(p4): add usage config, usage log, filtered words types and DB tables"
```

---

### Task 2: 使用配置 CRUD

**Files:**
- Create: `lib/db/usage-config.ts`
- Create: `lib/db/usage-log.ts`

**Interfaces:**
- Consumes: `UsageConfig`, `UsageLog` from Task 1 types
- Produces: `getUsageConfig()`, `updateUsageConfig(attrs)`, `getUsageLogs(from, to)`, `recordUsageTime(date, deltaSec)`

- [ ] **Step 1: Create lib/db/usage-config.ts**

```typescript
import { getDb } from "./index";
import type { UsageConfig } from "@/lib/utils/types";

export function getUsageConfig(): UsageConfig {
  const db = getDb();
  const row = db.prepare("SELECT * FROM usage_config WHERE id = 1").get();
  return row as UsageConfig;
}

export function updateUsageConfig(attrs: Partial<Pick<UsageConfig, "daily_limit_min" | "quiet_start" | "quiet_end" | "filter_enabled" | "restrictions_paused">>): void {
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
  db.prepare(`UPDATE usage_config SET ${fields.join(", ")} WHERE id = 1`).run(...values);
}
```

- [ ] **Step 2: Create lib/db/usage-log.ts**

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { UsageLog } from "@/lib/utils/types";

export function getUsageLogs(from: string, to: string): UsageLog[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM usage_log WHERE date >= ? AND date <= ? ORDER BY date ASC"
  ).all(from, to) as UsageLog[];
}

export function getTodayUsageSec(): number {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(
    "SELECT total_sec FROM usage_log WHERE date = ?"
  ).get(today) as { total_sec: number } | undefined;
  return row?.total_sec || 0;
}

export function recordUsageTime(date: string, deltaSec: number): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM usage_log WHERE date = ?").get(date);
  if (existing) {
    db.prepare("UPDATE usage_log SET total_sec = total_sec + ? WHERE date = ?").run(deltaSec, date);
  } else {
    db.prepare("INSERT INTO usage_log (id, date, total_sec) VALUES (?, ?, ?)").run(uuid(), date, deltaSec);
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: successful.

- [ ] **Step 4: Commit**

```bash
git add lib/db/usage-config.ts lib/db/usage-log.ts
git commit -m "feat(p4): add usage config and usage log CRUD modules"
```

---

### Task 3: 敏感词管理 CRUD

**Files:**
- Create: `lib/db/filtered-words.ts`

**Interfaces:**
- Consumes: `FilteredWord` from Task 1
- Produces: `getFilteredWords()`, `addFilteredWord(word)`, `removeFilteredWord(id)`, `checkTextFilter(text)` → `{ blocked: boolean, matched: string | null }`

- [ ] **Step 1: Create lib/db/filtered-words.ts**

```typescript
import { getDb } from "./index";
import type { FilteredWord } from "@/lib/utils/types";

export function getFilteredWords(): FilteredWord[] {
  const db = getDb();
  return db.prepare("SELECT * FROM filtered_words ORDER BY id ASC").all() as FilteredWord[];
}

export function addFilteredWord(word: string): FilteredWord {
  const db = getDb();
  const trimmed = word.trim();
  if (!trimmed) throw new Error("敏感词不能为空");
  db.prepare("INSERT INTO filtered_words (word) VALUES (?)").run(trimmed);
  const row = db.prepare("SELECT * FROM filtered_words WHERE word = ?").get(trimmed);
  return row as FilteredWord;
}

export function removeFilteredWord(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM filtered_words WHERE id = ?").run(id);
}

/** Check if text contains any filtered word. Returns the first match. */
export function checkTextFilter(text: string): { blocked: boolean; matched: string | null } {
  const words = getFilteredWords();
  const lower = text.toLowerCase();
  for (const w of words) {
    if (lower.includes(w.word.toLowerCase())) {
      return { blocked: true, matched: w.word };
    }
  }
  return { blocked: false, matched: null };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: successful.

- [ ] **Step 3: Commit**

```bash
git add lib/db/filtered-words.ts
git commit -m "feat(p4): add filtered words CRUD and text check"
```

---

### Task 4: 使用控制 API

**Files:**
- Create: `app/api/usage/config/route.ts`
- Create: `app/api/usage/log/route.ts`
- Create: `app/api/usage/check/route.ts`

**Interfaces:**
- Consumes: `getUsageConfig`, `updateUsageConfig`; `getTodayUsageSec`, `recordUsageTime`
- Produces: `GET/PUT /api/usage/config`, `GET/POST /api/usage/log`, `GET /api/usage/check`

- [ ] **Step 1: Create app/api/usage/config/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUsageConfig, updateUsageConfig } from "@/lib/db/usage-config";

export async function GET() {
  const config = getUsageConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  updateUsageConfig({
    daily_limit_min: body.daily_limit_min as number | null | undefined,
    quiet_start: body.quiet_start as string | null | undefined,
    quiet_end: body.quiet_end as string | null | undefined,
    filter_enabled: body.filter_enabled as number | undefined,
    restrictions_paused: body.restrictions_paused as number | undefined,
  });
  return NextResponse.json({ config: getUsageConfig() });
}
```

- [ ] **Step 2: Create app/api/usage/log/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getTodayUsageSec, recordUsageTime } from "@/lib/db/usage-log";

export async function GET() {
  const todaySec = getTodayUsageSec();
  return NextResponse.json({ today_sec: todaySec });
}

export async function POST(req: NextRequest) {
  const { delta_sec } = await req.json() as { delta_sec: number };
  const today = new Date().toISOString().slice(0, 10);
  recordUsageTime(today, delta_sec);
  return NextResponse.json({ today_sec: getTodayUsageSec() });
}
```

- [ ] **Step 3: Create app/api/usage/check/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getUsageConfig } from "@/lib/db/usage-config";
import { getTodayUsageSec } from "@/lib/db/usage-log";

/** Check if the child can start a new conversation right now */
export async function GET() {
  const config = getUsageConfig();

  // If restrictions are paused, allow everything
  if (config.restrictions_paused) {
    return NextResponse.json({ allowed: true });
  }

  // Check quiet hours
  if (config.quiet_start && config.quiet_end) {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = config.quiet_start.split(":").map(Number);
    const [eh, em] = config.quiet_end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    const inQuiet = startMin < endMin
      ? currentMin >= startMin && currentMin < endMin
      : currentMin >= startMin || currentMin < endMin; // overnight
    if (inQuiet) {
      return NextResponse.json({ allowed: false, reason: "quiet_hours" });
    }
  }

  // Check daily limit
  if (config.daily_limit_min) {
    const todaySec = getTodayUsageSec();
    const limitSec = config.daily_limit_min * 60;
    if (todaySec >= limitSec) {
      return NextResponse.json({ allowed: false, reason: "daily_limit", today_sec: todaySec, limit_sec: limitSec });
    }
  }

  return NextResponse.json({ allowed: true });
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: successful, 3 new API routes compiled.

- [ ] **Step 5: Commit**

```bash
git add app/api/usage/
git commit -m "feat(p4): add usage config, log, and check API routes"
```

---

### Task 5: 敏感词与家长项目管理 API

**Files:**
- Create: `app/api/parent/filtered-words/route.ts`
- Create: `app/api/parent/check-filter/route.ts`
- Create: `app/api/parent/projects/route.ts`

**Interfaces:**
- Consumes: `getFilteredWords`, `addFilteredWord`, `removeFilteredWord`, `checkTextFilter`; `listProjects`
- Consumes: `getDb` for project stats aggregation
- Produces: 3 API routes

- [ ] **Step 1: Create app/api/parent/filtered-words/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getFilteredWords, addFilteredWord, removeFilteredWord } from "@/lib/db/filtered-words";

export async function GET() {
  const words = getFilteredWords();
  return NextResponse.json({ words });
}

export async function POST(req: NextRequest) {
  const { word } = await req.json() as { word: string };
  try {
    const fw = addFilteredWord(word);
    return NextResponse.json({ word: fw }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: number };
  removeFilteredWord(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create app/api/parent/check-filter/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUsageConfig } from "@/lib/db/usage-config";
import { checkTextFilter } from "@/lib/db/filtered-words";

export async function POST(req: NextRequest) {
  const config = getUsageConfig();
  if (!config.filter_enabled) {
    return NextResponse.json({ blocked: false, matched: null, filter_disabled: true });
  }
  const { text } = await req.json() as { text: string };
  const result = checkTextFilter(text);
  return NextResponse.json({ ...result, filter_disabled: false });
}
```

- [ ] **Step 3: Create app/api/parent/projects/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const sort = searchParams.get("sort") || "updated";

  let query = "SELECT * FROM projects";
  const conditions: string[] = [];
  const params: string[] = [];

  if (statusFilter) {
    conditions.push("status = ?");
    params.push(statusFilter);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += sort === "created" ? " ORDER BY created_at DESC" : " ORDER BY updated_at DESC";

  const projects = db.prepare(query).all(...params) as Array<{
    id: string; title: string; status: string; created_at: string; updated_at: string;
  }>;

  // Attach task progress for each project
  const result = projects.map(p => {
    const taskStats = db.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
       FROM tasks t
       JOIN milestones m ON m.id = t.milestone_id
       JOIN tracks tr ON tr.id = m.track_id
       WHERE tr.project_id = ?`
    ).get(p.id) as { total: number; done: number };

    return {
      ...p,
      tasks_total: taskStats.total,
      tasks_done: taskStats.done,
    };
  });

  return NextResponse.json({ projects: result });
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: successful.

- [ ] **Step 5: Commit**

```bash
git add app/api/parent/
git commit -m "feat(p4): add parent filtered-words, check-filter, and projects API routes"
```

---

### Task 6: 项目详情/导出/日志 API

**Files:**
- Create: `app/api/parent/projects/[id]/route.ts`
- Create: `app/api/parent/projects/[id]/export/route.ts`
- Create: `app/api/parent/export/route.ts`
- Create: `app/api/parent/logs/route.ts`

**Interfaces:**
- Consumes: `getDb`, existing DB tables (sessions, messages, competency_snapshots, badges, evidence_events, project_logs, check_ins, reflections)
- Produces: 4 API routes

- [ ] **Step 1: Create app/api/parent/projects/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getProject, updateProject } from "@/lib/db/projects";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const db = getDb();

  // Get session + messages
  let messages: Array<{ role: string; content: string; created_at: string }> = [];
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(project.session_id) as Record<string, unknown> | undefined;
  if (session) {
    messages = db.prepare(
      "SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC"
    ).all(project.session_id) as Array<{ role: string; content: string; created_at: string }>;
  }

  // Get project structure: tracks → milestones → tasks
  const tracks = db.prepare("SELECT * FROM tracks WHERE project_id = ? ORDER BY sort_order ASC").all(params.id) as Array<Record<string, unknown>>;
  const structure = tracks.map(track => {
    const milestones = db.prepare("SELECT * FROM milestones WHERE track_id = ? ORDER BY sort_order ASC").all(track.id) as Array<Record<string, unknown>>;
    return {
      ...track,
      milestones: milestones.map(m => ({
        ...m,
        tasks: db.prepare("SELECT * FROM tasks WHERE milestone_id = ? ORDER BY created_at ASC").all(m.id),
      })),
    };
  });

  // Get check-ins and reflections
  const checkIns = db.prepare("SELECT * FROM check_ins WHERE project_id = ? ORDER BY date DESC").all(params.id);
  const reflections = db.prepare("SELECT * FROM reflections WHERE project_id = ? ORDER BY created_at DESC").all(params.id);

  // Get project logs
  const logs = db.prepare("SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC").all(params.id);

  return NextResponse.json({
    project,
    session,
    messages,
    structure,
    check_ins: checkIns,
    reflections,
    logs,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { status } = await req.json() as { status: string };
  updateProject(params.id, { status });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create app/api/parent/projects/[id]/export/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { getDb } from "@/lib/db/index";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const db = getDb();
  const checkIns = db.prepare("SELECT * FROM check_ins WHERE project_id = ?").all(params.id);
  const reflections = db.prepare("SELECT * FROM reflections WHERE project_id = ?").all(params.id);
  const logs = db.prepare("SELECT * FROM project_logs WHERE project_id = ?").all(params.id);

  const messages = db.prepare(
    "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"
  ).all(project.session_id);

  const exportData = {
    exported_at: new Date().toISOString(),
    version: "1.0",
    project,
    check_ins: checkIns,
    reflections,
    project_logs: logs,
    messages,
  };

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="project-${params.id}.json"`,
    },
  });
}
```

- [ ] **Step 3: Create app/api/parent/export/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const tables: Record<string, string> = {
    sessions: "sessions",
    messages: "messages",
    projects: "projects",
    tracks: "tracks",
    milestones: "milestones",
    tasks: "tasks",
    check_ins: "check_ins",
    reflections: "reflections",
    project_logs: "project_logs",
    competency_snapshots: "competency_snapshots",
    badges: "badges",
    evidence_events: "evidence_events",
    usage_log: "usage_log",
  };

  const data: Record<string, unknown[]> = {};
  for (const [key, table] of Object.entries(tables)) {
    let query = `SELECT * FROM ${table}`;
    const conditions: string[] = [];
    const params: string[] = [];

    if (from && to && tableHasColumn(table)) {
      const col = tableTimeColumn(table);
      if (col) {
        conditions.push(`${col} >= ? AND ${col} <= ?`);
        params.push(from, to);
      }
    }

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    data[key] = db.prepare(query).all(...params);
  }

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    version: "1.0",
    date_range: from && to ? { from, to } : "all",
    tables: data,
  }, {
    headers: {
      "Content-Disposition": "attachment; filename=kid-aider-export.json",
    },
  });
}

function tableHasColumn(table: string): boolean {
  return ["sessions", "messages", "projects", "tasks", "check_ins", "reflections",
    "project_logs", "competency_snapshots", "badges", "evidence_events", "usage_log"].includes(table);
}

function tableTimeColumn(table: string): string | null {
  const map: Record<string, string> = {
    sessions: "created_at", messages: "created_at", projects: "created_at",
    tasks: "created_at", check_ins: "date", reflections: "created_at",
    project_logs: "created_at", competency_snapshots: "week_start",
    badges: "earned_at", evidence_events: "created_at", usage_log: "date",
  };
  return map[table] || null;
}
```

- [ ] **Step 4: Create app/api/parent/logs/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export async function GET() {
  const db = getDb();

  // Usage summary
  const usageSummary = db.prepare(
    "SELECT COALESCE(SUM(total_sec), 0) as total_sec, COUNT(*) as active_days FROM usage_log"
  ).get() as { total_sec: number; active_days: number };

  // Last 20 project logs
  const recentLogs = db.prepare(
    `SELECT pl.*, p.title as project_title
     FROM project_logs pl
     JOIN projects p ON p.id = pl.project_id
     ORDER BY pl.created_at DESC LIMIT 20`
  ).all();

  // Last 5 AI calls — look for chat response messages (role='guide' or created by system logic)
  const recentAICalls = db.prepare(
    `SELECT id, role, created_at FROM messages
     WHERE role = 'guide'
     ORDER BY created_at DESC LIMIT 5`
  ).all() as Array<{ id: string; role: string; created_at: string }>;

  return NextResponse.json({
    usage_summary: {
      total_sec: usageSummary.total_sec,
      total_hours: Math.round(usageSummary.total_sec / 3600 * 10) / 10,
      active_days: usageSummary.active_days,
      avg_min_per_day: usageSummary.active_days > 0
        ? Math.round(usageSummary.total_sec / usageSummary.active_days / 60)
        : 0,
    },
    recent_logs: recentLogs,
    recent_ai_calls: recentAICalls,
  });
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: successful.

- [ ] **Step 6: Commit**

```bash
git add app/api/parent/
git commit -m "feat(p4): add project detail, export, full export, and logs API routes"
```

---

### Task 7: Chat API 集成使用检查

**Files:**
- Modify: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: `getUsageConfig`, `getTodayUsageSec`, `recordUsageTime`; `checkTextFilter`
- Consumes: `app/api/usage/check` logic, but embedded directly (no HTTP call to self)

- [ ] **Step 1: Add usage check at the top of POST handler**

In `app/api/chat/route.ts`, after the `import` block (around line 9), add:

```typescript
import { getUsageConfig } from "@/lib/db/usage-config";
import { getTodayUsageSec, recordUsageTime } from "@/lib/db/usage-log";
import { checkTextFilter } from "@/lib/db/filtered-words";
```

At the start of the POST function body (after line 16 `const { message, sessionId, ageGroup } = ...`), add:

```typescript
  // ── P4 usage check ──────────────────────────────────────────
  const usageConfig = getUsageConfig();

  if (!usageConfig.restrictions_paused) {
    // Quiet hours check
    if (usageConfig.quiet_start && usageConfig.quiet_end) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = usageConfig.quiet_start.split(":").map(Number);
      const [eh, em] = usageConfig.quiet_end.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const inQuiet = startMin < endMin
        ? currentMin >= startMin && currentMin < endMin
        : currentMin >= startMin || currentMin < endMin;
      if (inQuiet) {
        return NextResponse.json(
          { content: "现在是休息时间，明天再来探索吧！", blocked: true },
          { status: 200 }
        );
      }
    }

    // Daily limit check
    if (usageConfig.daily_limit_min) {
      const todaySec = getTodayUsageSec();
      const limitSec = usageConfig.daily_limit_min * 60;
      if (todaySec >= limitSec) {
        return NextResponse.json(
          { content: "今天的探索时间到啦！明天再来吧 🌙", blocked: true },
          { status: 200 }
        );
      }
    }
  }
  // ── End P4 usage check ──────────────────────────────────────
```

- [ ] **Step 2: Add content filter at end of POST handler**

After the guide response is generated (before it's returned to the client), add content filter check. Find the `return NextResponse.json(...)` for the successful chat response and wrap the content:

After the line where `guideContent` / response content is ready (before the final `return NextResponse.json`), add:

```typescript
  // ── P4 content filter check ──────────────────────────────────
  let finalContent = guideContent;
  if (usageConfig.filter_enabled) {
    const filterResult = checkTextFilter(guideContent);
    if (filterResult.blocked) {
      finalContent = "这个问题我们换一种方式回答。";
    }
  }
  // ── End P4 content filter ────────────────────────────────────
```

Replace `guideContent` with `finalContent` in the response.

- [ ] **Step 3: Add usage time recording after response**

After the successful response is returned, record usage time incrementally (estimate ~10 seconds per chat exchange as a rough increment):

At the end of the POST function, before `return NextResponse.json(...)`, add:

```typescript
  // Record usage time (rough estimate: ~10s per exchange)
  const today = new Date().toISOString().slice(0, 10);
  recordUsageTime(today, 10);
```

- [ ] **Step 4: 80% warning**

After the daily limit check (in the usage check block from Step 1), before the 100% block, add:

```typescript
    // 80% warning
    if (usageConfig.daily_limit_min) {
      const todaySec = getTodayUsageSec();
      const limitSec = usageConfig.daily_limit_min * 60;
      const remaining = Math.max(0, limitSec - todaySec);
      if (todaySec >= limitSec * 0.8 && todaySec < limitSec) {
        // Attach a warning flag to the eventual response
        // We'll set a flag and append to the response content
        const remainingMin = Math.ceil(remaining / 60);
        guideContent = guideContent + `\n\n⏰ 今天还剩约 ${remainingMin} 分钟哦！`;
      }
    }
```

Note: Place this AFTER the response is generated but BEFORE the final return. Adjust to insert the warning into the stream if streaming.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: successful.

- [ ] **Step 6: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(p4): integrate usage check, content filter, and time logging into chat API"
```

---

### Task 8: 家长面板页面 — Tab 框架 + 使用控制

**Files:**
- Create: `app/parent/page.tsx`
- Create: `components/parent/usage-control.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/usage/config`, `GET /api/usage/log`
- Produces: Parent panel page with tab framework + usage control tab

- [ ] **Step 1: Create app/parent/page.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UsageControl } from "@/components/parent/usage-control";
import type { UsageConfig } from "@/lib/utils/types";

type Tab = "control" | "projects" | "data" | "logs";

export default function ParentPage() {
  const [tab, setTab] = useState<Tab>("control");
  const [config, setConfig] = useState<UsageConfig | null>(null);

  useEffect(() => {
    fetch("/api/usage/config")
      .then(r => r.json())
      .then(d => setConfig(d.config));
  }, []);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "control", label: "控制", icon: "🔧" },
    { key: "projects", label: "项目", icon: "📁" },
    { key: "data", label: "数据", icon: "📊" },
    { key: "logs", label: "日志", icon: "📋" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">👨‍👩‍👧 家长控制</h1>
      </div>

      {/* Restrictions toggle */}
      {config && (
        <div className="flex items-center gap-3 mb-6 p-3 bg-surface border border-border rounded-card">
          <span className="text-lg">{config.restrictions_paused ? "🔓" : "🔒"}</span>
          <span className="text-body-sm font-semibold">
            {config.restrictions_paused ? "限制已暂停" : "限制已开启"}
          </span>
          <button
            onClick={async () => {
              const res = await fetch("/api/usage/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restrictions_paused: config.restrictions_paused ? 0 : 1 }),
              });
              const d = await res.json();
              setConfig(d.config);
            }}
            className="ml-auto text-body-sm text-primary hover:underline"
          >
            {config.restrictions_paused ? "恢复限制" : "暂停限制"}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 mb-6 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-body-sm border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-ink-tertiary hover:text-ink"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "control" && <UsageControl config={config} onConfigChange={setConfig} />}
      {tab === "projects" && <p className="text-ink-tertiary text-body-sm">项目管理 — 待 Task 9 实现</p>}
      {tab === "data" && <p className="text-ink-tertiary text-body-sm">数据面板 — 待 Task 10 实现</p>}
      {tab === "logs" && <p className="text-ink-tertiary text-body-sm">系统日志 — 待 Task 10 实现</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create components/parent/usage-control.tsx**

```typescript
"use client";

import { useState } from "react";
import type { UsageConfig } from "@/lib/utils/types";

interface Props {
  config: UsageConfig | null;
  onConfigChange: (c: UsageConfig) => void;
}

const DURATION_OPTIONS = [30, 60, 90, 120, 0]; // 0 = unlimited

export function UsageControl({ config, onConfigChange }: Props) {
  const [saving, setSaving] = useState(false);

  if (!config) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const update = async (attrs: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch("/api/usage/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attrs),
    });
    const d = await res.json();
    onConfigChange(d.config);
    setSaving(false);
  };

  const currentLimit = config.daily_limit_min || 0;

  return (
    <div className="space-y-6">
      {/* Daily limit */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">⏱ 每日使用时长</h2>
        <div className="flex items-center gap-2 mb-2">
          {DURATION_OPTIONS.map(min => (
            <button
              key={min}
              onClick={() => update({ daily_limit_min: min === 0 ? null : min })}
              disabled={saving}
              className={`px-3 py-1.5 text-body-sm rounded-btn border transition-colors ${
                currentLimit === min
                  ? "border-primary bg-primary/5 text-primary font-semibold"
                  : "border-border text-ink-tertiary hover:text-ink"
              }`}
            >
              {min === 0 ? "不限" : `${min} 分钟`}
            </button>
          ))}
        </div>
        <p className="text-body-sm text-ink-tertiary">
          到达限制后将温和提示，不强制锁屏
        </p>
      </section>

      {/* Quiet hours */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🌙 免打扰时段</h2>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={config.quiet_start || ""}
            onChange={e => update({ quiet_start: e.target.value || null })}
            disabled={saving}
            className="border border-border rounded-btn px-3 py-1.5 text-body-sm"
          />
          <span className="text-ink-tertiary text-body-sm">至</span>
          <input
            type="time"
            value={config.quiet_end || ""}
            onChange={e => update({ quiet_end: e.target.value || null })}
            disabled={saving}
            className="border border-border rounded-btn px-3 py-1.5 text-body-sm"
          />
        </div>
        <p className="text-body-sm text-ink-tertiary mt-2">
          时段内阻止新会话，不打断进行中的对话
        </p>
      </section>

      {/* Content filter */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🛡 内容过滤</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => update({ filter_enabled: config.filter_enabled ? 0 : 1 })}
            disabled={saving}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.filter_enabled ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.filter_enabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-body-sm font-semibold">
            {config.filter_enabled ? "已开启" : "已关闭"}
          </span>
        </div>
        <p className="text-body-sm text-ink-tertiary mt-2">
          AI 输出命中敏感词时替换为安全提示
        </p>
        {/* Filtered words management — simplified, full CRUD in Task 9 */}
      </section>
    </div>
  );
}
```

Note: `input[type="time"]` is a native HTML time picker, works in all modern browsers.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: successful, `/parent` route compiled.

- [ ] **Step 4: Commit**

```bash
git add app/parent/ components/parent/
git commit -m "feat(p4): add parent panel page with tab framework and usage control"
```

---

### Task 9: 敏感词管理 + 项目管理组件

**Files:**
- Create: `components/parent/filtered-words-manager.tsx`
- Create: `components/parent/project-manager.tsx`
- Create: `components/parent/project-detail-modal.tsx`
- Modify: `app/parent/page.tsx` (wire in new tab components)

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/parent/filtered-words`, `GET /api/parent/projects`, `GET/PATCH /api/parent/projects/[id]`
- Produces: FilteredWordsManager, ProjectManager, ProjectDetailModal

- [ ] **Step 1: Create components/parent/filtered-words-manager.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";
import type { FilteredWord } from "@/lib/utils/types";

export function FilteredWordsManager() {
  const [words, setWords] = useState<FilteredWord[]>([]);
  const [newWord, setNewWord] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchWords = () => {
    fetch("/api/parent/filtered-words")
      .then(r => r.json())
      .then(d => setWords(d.words))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWords(); }, []);

  const addWord = async () => {
    if (!newWord.trim()) return;
    await fetch("/api/parent/filtered-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: newWord.trim() }),
    });
    setNewWord("");
    fetchWords();
  };

  const removeWord = async (id: number) => {
    await fetch("/api/parent/filtered-words", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchWords();
  };

  if (loading) {
    return <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />;
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addWord()}
          placeholder="添加敏感词..."
          className="flex-1 border border-border rounded-btn px-3 py-1.5 text-body-sm"
        />
        <button
          onClick={addWord}
          className="bg-primary text-white rounded-btn px-4 py-1.5 text-body-sm font-semibold"
        >
          添加
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words.map(w => (
          <span
            key={w.id}
            className="inline-flex items-center gap-1 bg-surface-raised border border-border rounded-btn px-2.5 py-1 text-body-sm"
          >
            {w.word}
            <button
              onClick={() => removeWord(w.id)}
              className="text-ink-tertiary hover:text-danger transition-colors ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create components/parent/project-manager.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";
import { ProjectDetailModal } from "./project-detail-modal";

interface ParentProject {
  id: string;
  title: string;
  status: string;
  tasks_total: number;
  tasks_done: number;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "进行中",
  paused: "已暂停",
  completed: "已完成",
  archived: "已归档",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-600",
  paused: "text-yellow-600",
  completed: "text-blue-600",
  archived: "text-gray-400",
};

export function ProjectManager() {
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchProjects = () => {
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    fetch(`/api/parent/projects${params}`)
      .then(r => r.json())
      .then(d => setProjects(d.projects))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, [filter]);

  const changeStatus = async (id: string, status: string) => {
    await fetch(`/api/parent/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProjects();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        {["", "active", "completed", "archived"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-body-sm rounded-btn border transition-colors ${
              filter === s ? "border-primary bg-primary/5 text-primary" : "border-border text-ink-tertiary"
            }`}
          >
            {s === "" ? "全部" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <p className="text-ink-tertiary text-body-sm text-center py-8">暂无项目</p>
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <div key={p.id} className="bg-surface border border-border rounded-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-body font-bold text-ink">{p.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-body-sm text-ink-tertiary">
                    <span className={STATUS_COLORS[p.status]}>● {STATUS_LABELS[p.status]}</span>
                    <span>任务 {p.tasks_done}/{p.tasks_total}</span>
                    <span>{new Date(p.created_at).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDetailId(p.id)}
                    className="text-body-sm text-primary hover:underline px-2"
                  >
                    详情
                  </button>
                  {p.status !== "archived" ? (
                    <button
                      onClick={() => changeStatus(p.id, "archived")}
                      className="text-body-sm text-ink-tertiary hover:text-ink px-2"
                    >
                      归档
                    </button>
                  ) : (
                    <button
                      onClick={() => changeStatus(p.id, "paused")}
                      className="text-body-sm text-ink-tertiary hover:text-ink px-2"
                    >
                      恢复
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detailId && (
        <ProjectDetailModal
          projectId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create components/parent/project-detail-modal.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";

interface DetailData {
  project: { id: string; title: string; status: string; created_at: string };
  messages: Array<{ role: string; content: string; created_at: string }>;
  structure: Array<{
    id: string; name: string; type: string;
    milestones: Array<{
      id: string; title: string; status: string;
      tasks: Array<{ id: string; title: string; status: string; difficulty: number }>;
    }>;
  }>;
}

interface Props {
  projectId: string;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  child: "👦 孩子",
  guide: "🤖 引导",
  system: "⚙️ 系统",
};

export function ProjectDetailModal({ projectId, onClose }: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/parent/projects/${projectId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-card w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <p className="text-ink-tertiary text-center py-8">加载失败</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-body-lg font-bold">{data.project.title}</h2>
              <button onClick={onClose} className="text-ink-tertiary hover:text-ink text-xl">×</button>
            </div>

            {/* Project structure */}
            <section>
              <h3 className="text-body font-bold mb-2">📋 项目结构</h3>
              {data.structure.map(track => (
                <div key={track.id} className="mb-3">
                  <p className="text-body-sm font-semibold text-ink mb-1">
                    {track.type === "software" ? "💻" : "🔧"} {track.name}
                  </p>
                  {track.milestones.map(m => (
                    <div key={m.id} className="ml-4 mb-1">
                      <p className="text-body-sm text-ink-tertiary mb-0.5">
                        {m.status === "done" ? "✅" : "○"} {m.title}
                      </p>
                      {m.tasks.map(t => (
                        <p key={t.id} className="ml-4 text-body-sm text-ink-tertiary">
                          {t.status === "done" ? "✓" : "·"} {t.title} (难度 {t.difficulty})
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </section>

            {/* Conversation */}
            <section>
              <h3 className="text-body font-bold mb-2">💬 对话记录</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.messages.slice(-30).map((m, i) => (
                  <div key={i} className="text-body-sm">
                    <span className="text-ink-tertiary">{ROLE_LABELS[m.role] || m.role}: </span>
                    <span className="text-ink">{m.content.slice(0, 200)}{m.content.length > 200 ? "…" : ""}</span>
                  </div>
                ))}
                {data.messages.length === 0 && (
                  <p className="text-ink-tertiary text-body-sm">暂无对话</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into parent page**

In `app/parent/page.tsx`, add imports:

```typescript
import { FilteredWordsManager } from "@/components/parent/filtered-words-manager";
import { ProjectManager } from "@/components/parent/project-manager";
```

Replace the tab content placeholders:
- `{tab === "control" && ...}` — expand to include `<FilteredWordsManager />` below `<UsageControl>`
- `{tab === "projects" && <p>...</p>}` → `{tab === "projects" && <ProjectManager />}`

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: successful.

- [ ] **Step 6: Commit**

```bash
git add components/parent/ app/parent/
git commit -m "feat(p4): add filtered words manager, project manager, and detail modal"
```

---

### Task 10: 数据面板 + 系统日志视图

**Files:**
- Create: `components/parent/data-panel.tsx`
- Create: `components/parent/system-log.tsx`
- Modify: `app/parent/page.tsx` (wire in remaining tabs)

**Interfaces:**
- Consumes: `POST /api/competency`, `GET /api/parent/export`, `GET /api/parent/logs`
- Produces: DataPanel, SystemLog

- [ ] **Step 1: Create components/parent/data-panel.tsx**

```typescript
"use client";

import { useState } from "react";
import type { CompetencySnapshot, Badge } from "@/lib/utils/types";

export function DataPanel() {
  const [snapshotResult, setSnapshotResult] = useState<{
    snapshots: CompetencySnapshot[];
    new_badges: Badge[];
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const triggerSnapshot = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/competency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snapshot" }),
      });
      const data = await res.json();
      setSnapshotResult(data);
    } catch {
      setSnapshotResult(null);
    } finally {
      setGenerating(false);
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/parent/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kid-aider-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const DIM_LABELS: Record<string, string> = {
    clarification: "需求澄清力", decomposition: "分解力",
    execution: "执行力", reflection: "反思力",
    creativity: "创造力", persistence: "坚持力",
  };

  return (
    <div className="space-y-6">
      {/* Manual snapshot trigger */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📸 手动生成快照</h2>
        <p className="text-body-sm text-ink-tertiary mb-3">
          立即生成本周能力快照，无需等待自然周触发
        </p>
        <button
          onClick={triggerSnapshot}
          disabled={generating}
          className="bg-primary text-white rounded-btn px-4 py-2 text-body-sm font-semibold disabled:opacity-50"
        >
          {generating ? "生成中..." : "生成本周快照"}
        </button>

        {snapshotResult && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {snapshotResult.snapshots.map(s => (
              <div key={s.dimension} className="flex items-center gap-2 text-body-sm">
                <span className="text-ink-tertiary">{DIM_LABELS[s.dimension] || s.dimension}</span>
                <span className="font-bold">{s.score}</span>
                <span className="text-ink-tertiary">({s.score_type === "rule" ? "规则" : "AI"})</span>
              </div>
            ))}
            {snapshotResult.new_badges.length > 0 && (
              <div className="col-span-2 mt-2 p-2 bg-yellow-50 rounded-btn text-body-sm">
                🎉 新徽章: {snapshotResult.new_badges.map((b: Badge) => b.icon + b.label).join(", ")}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Full data export */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📦 数据导出</h2>
        <p className="text-body-sm text-ink-tertiary mb-3">
          导出全部数据为 JSON 文件（含会话、项目、能力画像、徽章）
        </p>
        <button
          onClick={exportAll}
          disabled={exporting}
          className="bg-primary text-white rounded-btn px-4 py-2 text-body-sm font-semibold disabled:opacity-50"
        >
          {exporting ? "导出中..." : "导出全部数据"}
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create components/parent/system-log.tsx**

```typescript
"use client";

import { useEffect, useState } from "react";

interface LogData {
  usage_summary: {
    total_hours: number;
    active_days: number;
    avg_min_per_day: number;
  };
  recent_logs: Array<{
    id: string; action: string; detail: string; created_at: string; project_title: string;
  }>;
  recent_ai_calls: Array<{
    id: string; role: string; created_at: string;
  }>;
}

const ACTION_LABELS: Record<string, string> = {
  task_done: "✅ 任务完成", task_undo: "↩️ 撤销任务",
  check_in: "📅 打卡", reflection: "💭 复盘",
  project_complete: "🎉 项目完成", project_resume: "🔄 项目恢复",
  project_create: "🆕 项目创建",
};

export function SystemLog() {
  const [data, setData] = useState<LogData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/parent/logs")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-ink-tertiary text-body-sm text-center py-8">加载失败</p>;
  }

  return (
    <div className="space-y-6">
      {/* Usage summary */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📊 使用摘要</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{data.usage_summary.total_hours}</p>
            <p className="text-body-sm text-ink-tertiary">总小时数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{data.usage_summary.active_days}</p>
            <p className="text-body-sm text-ink-tertiary">活跃天数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{data.usage_summary.avg_min_per_day}</p>
            <p className="text-body-sm text-ink-tertiary">日均分钟</p>
          </div>
        </div>
      </section>

      {/* Recent operation logs */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📋 最近操作</h2>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {data.recent_logs.map(log => (
            <div key={log.id} className="flex items-center gap-2 text-body-sm">
              <span className="text-ink-tertiary w-32 shrink-0">
                {new Date(log.created_at).toLocaleString("zh-CN")}
              </span>
              <span>{ACTION_LABELS[log.action] || log.action}</span>
              <span className="text-ink-tertiary">{log.detail}</span>
              <span className="text-ink-tertiary text-xs">({log.project_title})</span>
            </div>
          ))}
          {data.recent_logs.length === 0 && (
            <p className="text-ink-tertiary text-body-sm text-center py-4">暂无操作记录</p>
          )}
        </div>
      </section>

      {/* Recent AI calls */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🤖 最近 AI 调用</h2>
        <div className="space-y-1.5">
          {data.recent_ai_calls.map(call => (
            <div key={call.id} className="text-body-sm text-ink-tertiary">
              {new Date(call.created_at).toLocaleString("zh-CN")} — {call.role}
            </div>
          ))}
          {data.recent_ai_calls.length === 0 && (
            <p className="text-ink-tertiary text-body-sm text-center py-4">暂无调用记录</p>
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Wire into parent page**

In `app/parent/page.tsx`:
- Import `DataPanel` and `SystemLog`
- Replace placeholders:
  - `{tab === "data" && <p>...</p>}` → `{tab === "data" && <DataPanel />}`
  - `{tab === "logs" && <p>...</p>}` → `{tab === "logs" && <SystemLog />}`

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: successful.

- [ ] **Step 5: Commit**

```bash
git add components/parent/ app/parent/
git commit -m "feat(p4): add data panel with snapshot trigger and export, system log view"
```

---

### Task 11: 模型配置迁移 + 设置页面收尾

**Files:**
- Modify: `app/parent/page.tsx` (add model config tab or embed)
- Modify: `app/settings/page.tsx` (remove model config, add parent link)
- Modify: `app/page.tsx` (no parent link — spec says hidden from nav)

**Interfaces:**
- Consumes: Existing `ModelProfileList` component from `components/settings/model-profile-list`

- [ ] **Step 1: Move model config to parent panel**

In `app/parent/page.tsx`, add a 5th tab "模型" or embed in the data tab. Simplest: add to tab list and import `ModelProfileList`:

```typescript
import { ModelProfileList } from "@/components/settings/model-profile-list";

// In the tabs array, add:
{ key: "models", label: "模型", icon: "🤖" },

// In tab content:
{tab === "models" && <ModelProfileList />}
```

Note: `ModelProfileList` is already "use client" and self-contained.

- [ ] **Step 2: Update settings page**

`app/settings/page.tsx` — remove `ModelProfileList` import and usage. Add a small text link to `/parent` at the bottom:

```tsx
<div className="mt-8 pt-4 border-t border-border">
  <Link href="/parent" className="text-body-sm text-ink-tertiary hover:text-ink transition-colors">
    家长控制 →
  </Link>
</div>
```

- [ ] **Step 3: Remove age group from settings**

Age group selection moves to the parent panel. If there's an age group control in settings, replace it with a note: "年龄分组已移至家长控制面板。"

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: successful. Settings page compiles without ModelProfileList.

- [ ] **Step 5: Commit**

```bash
git add app/parent/ app/settings/ app/page.tsx
git commit -m "feat(p4): migrate model config to parent panel, update settings page"
```

---

### Task 12: 集成联调

**Files:**
- Modify: `DEVELOPMENT.md`
- (Possible small fixes discovered during e2e testing)

**Steps:**

- [ ] **Step 1: End-to-end walkthrough**

1. `npm run build` → should pass
2. Visit `/parent` → all 5 tabs render
3. Set daily limit to 30 min, quiet hours 21:00-07:00
4. Verify `/api/usage/check` returns `{ allowed: false }` during quiet hours
5. Visit `/chat` and verify blocked message during quiet hours
6. Enable content filter, add a test word, verify it blocks
7. Visit projects tab → see all projects with stats
8. Click detail → see conversation and structure
9. Try archive/restore a project
10. Generate a snapshot from data panel
11. Export full data → verify JSON downloads
12. View system logs → see usage summary

- [ ] **Step 2: Update DEVELOPMENT.md**

Replace progress line:
```
P1 ██████████ 100% | P2 ██████████ 100% | P3 ██████████ 100% | P4 ██████████ 100% | P5-P6 未开始
```

Add P4 section:
```markdown
## P4 · 家长控制（目标：2026-08-23）
- [x] Task 1: P4 类型与数据库扩展
- [x] Task 2: 使用配置 CRUD
- [x] Task 3: 敏感词管理 CRUD
- [x] Task 4: 使用控制 API
- [x] Task 5: 敏感词与家长项目管理 API
- [x] Task 6: 项目详情/导出/日志 API
- [x] Task 7: Chat API 集成使用检查
- [x] Task 8: 家长面板页面 — Tab 框架 + 使用控制
- [x] Task 9: 敏感词管理 + 项目管理组件
- [x] Task 10: 数据面板 + 系统日志视图
- [x] Task 11: 模型配置迁移 + 设置页面收尾
- [x] Task 12: 集成联调
```

- [ ] **Step 3: Commit**

```bash
git add DEVELOPMENT.md
git commit -m "feat(p4): update DEVELOPMENT.md — P4 complete"
```

---

*Plan complete. 12 tasks, covering types → DB → CRUD → API routes → chat integration → page + components → migration → e2e.*
