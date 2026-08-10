# P8b 内容-项目集成 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通探索页→内容生成→进入项目工坊的闭环：将话题 challenges 转为项目里程碑，project_prompt 作为对话种子，支持项目地图和聊天引导双入口。

**Architecture:** 新增 POST /api/topics/[id]/start-project 作为核心转化 API（challenges→milestones + project_prompt→session seed），新增 StartProjectDialog 确认弹窗（推荐项目名+里程碑预览+双入口按钮），扩展 projects/milestones 表和类型支持 topic 溯源。

**Tech Stack:** Next.js 14 App Router + TypeScript strict + Tailwind CSS v3 + better-sqlite3 (synchronous)

## Global Constraints

- 零新增 npm 依赖
- 不改变 SSE 架构
- TypeScript strict，无 `any`
- 遵循项目 Tailwind token 设计系统
- P1-P8a 所有现有功能不受影响
- P8a 积分系统 side-effect 追加
- 所有新路由 `export const dynamic = "force-dynamic"`
- DB 访问通过 `import { getDb } from "./index"`
- ID 使用 uuid v4
- 时间戳格式 `new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")`

---

## File Map

| 文件 | 操作 | 职责 |
|---|---|---|
| `lib/utils/types.ts:336-340` | Modify | 扩展 ActionType、新增 ProjectSource/StartProjectRequest/StartProjectResponse、扩展 Project/Milestone |
| `lib/db/index.ts:345-393` | Modify | ALTER TABLE projects 新增 source/source_topic_id；ALTER TABLE milestones 新增 challenge_json |
| `lib/db/projects.ts:5-19` | Modify | createProject 扩展 source/source_topic_id；新增 getProjectByTopic |
| `lib/db/milestones.ts:5-21` | Modify | createMilestone 扩展 challenge_json |
| `lib/engine/points-engine.ts:13-30` | Modify | DAILY_CAPS + POINTS_RULES 新增 create_project |
| `app/api/topics/[id]/projects/route.ts` | Create | GET 查询话题关联项目 |
| `app/api/topics/[id]/start-project/route.ts` | Create | POST 核心转化 API |
| `components/parent/start-project-dialog.tsx` | Create | 项目确认弹窗 |
| `components/parent/topic-detail.tsx:240-251` | Modify | 替换 TODO 按钮，接入弹窗 |

---

### Task 1: 类型定义与数据库扩展

**Files:**
- Modify: `lib/utils/types.ts:336-340`
- Modify: `lib/db/index.ts:345-393`
- Modify: `lib/db/projects.ts:5-19`
- Modify: `lib/db/milestones.ts:5-21`

**Interfaces:**
- Consumes: (none — first task)
- Produces:
  - `ActionType` 新增 `"create_project"`
  - `ProjectSource` type
  - `StartProjectRequest` / `StartProjectResponse` interfaces
  - `Project` interface 新增 `source: ProjectSource` + `source_topic_id: string | null`
  - `Milestone` interface 新增 `challenge_json: string | null`
  - `CreateProjectAttrs` 新增 `source?` + `source_topic_id?` + `session_id` 改为可选
  - `createProject()` 处理新字段
  - `getProjectByTopic(topicId: string): Project | undefined` 函数
  - `CreateMilestoneAttrs` 新增 `challenge_json?`
  - `createMilestone()` 写入 `challenge_json`
  - 2 条 ALTER TABLE 语句

- [ ] **Step 1: 扩展 types.ts — ActionType**

在 `lib/utils/types.ts` 第 338 行 ActionType 联合类型末尾追加：

```typescript
export type ActionType = "login" | "explore_topic" | "complete_challenge" | "task_done" | "check_in" | "reflection" | "create_project";
```

- [ ] **Step 2: 扩展 types.ts — 新增类型和接口扩展**

在 ActionType 之后追加（第 341 行附近）：

```typescript
export type ProjectSource = "funnel" | "topic";

export interface StartProjectRequest {
  project_name: string;
  goto: "project" | "chat";
  language?: string;
}

export interface StartProjectResponse {
  project: Project;
  session?: { id: string };
}
```

在 Project 接口中（第 71-77 行），追加 `source` 和 `source_topic_id` 字段：

```typescript
export interface Project {
  id: string;
  session_id: string;
  title: string;
  status: ProjectStatus;
  source: ProjectSource;          // ← 新增
  source_topic_id: string | null;  // ← 新增
  created_at: string;
  updated_at: string;
}
```

在 Milestone 接口中（第 89-98 行），追加 `challenge_json` 字段（description 已存在）：

```typescript
export interface Milestone {
  id: string;
  track_id: string;
  title: string;
  description: string;
  sort_order: number;
  status: ItemStatus;
  completed_at: string | null;
  challenge_json: string | null;  // ← 新增
  created_at: string;
}
```

- [ ] **Step 3: 扩展 db/index.ts — ALTER TABLE**

在 `lib/db/index.ts` 末尾的 `db.exec(` 闭合之前（第 393 行 `);` 之前），/即在 `CREATE INDEX IF NOT EXISTS idx_badge_unlock_user ON badge_unlock(user_id);` 之后、闭合反引号和 `);` 之前），追加 2 条 ALTER：

```sql
ALTER TABLE projects ADD COLUMN source TEXT DEFAULT 'funnel';
ALTER TABLE projects ADD COLUMN source_topic_id TEXT;
ALTER TABLE milestones ADD COLUMN challenge_json TEXT;
```

> 注意：SQLite 的 ALTER TABLE ADD COLUMN 使用 `IF NOT EXISTS` 需要 SQLite 3.35+。better-sqlite3 基于的 SQLite 版本通常满足。但 safer 做法是使用 try/catch 包裹或直接写 ALTER TABLE（因为 DDL 在 `CREATE TABLE IF NOT EXISTS` 模式下，重复执行 ALTER 会报错）。用 `db.exec()` 中每条 ALTER 单独 try/catch 或用 `CREATE TABLE IF NOT EXISTS` 重建策略代价太高——此处使用 SQLite 的 `ALTER TABLE ... ADD COLUMN` 并在 exec 中用分号分隔，依赖 better-sqlite3 的错误容忍。

**务实方案：** 在 `lib/db/index.ts` 的 `db.exec()` 调用之后、`return db;` 之前，用单独的 try/catch 执行 ALTER：

```typescript
// P8b: schema migration for topic→project integration
try { db.exec("ALTER TABLE projects ADD COLUMN source TEXT DEFAULT 'funnel'"); } catch {}
try { db.exec("ALTER TABLE projects ADD COLUMN source_topic_id TEXT"); } catch {}
try { db.exec("ALTER TABLE milestones ADD COLUMN challenge_json TEXT"); } catch {}
```

将这三行放在 `return db;` 之前（第 396 行）。

- [ ] **Step 4: 扩展 projects.ts**

修改 `lib/db/projects.ts` 的 `CreateProjectAttrs` 接口：

```typescript
interface CreateProjectAttrs {
  session_id: string;
  title: string;
  source?: string;
  source_topic_id?: string;
}
```

修改 `createProject` 函数，在 INSERT 时写入新字段：

```typescript
export function createProject(attrs: CreateProjectAttrs): Project {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(
    `INSERT INTO projects (id, session_id, title, status, source, source_topic_id, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`
  ).run(id, attrs.session_id, attrs.title, attrs.source || "funnel", attrs.source_topic_id || null, now, now);
  return getProject(id)!;
}
```

在文件末尾新增 `getProjectByTopic` 函数：

```typescript
export function getProjectByTopic(topicId: string): Project | undefined {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM projects WHERE source_topic_id = ? AND source = 'topic' ORDER BY created_at DESC LIMIT 1"
  ).get(topicId);
  return row ? (row as Project) : undefined;
}
```

- [ ] **Step 5: 扩展 milestones.ts**

修改 `lib/db/milestones.ts` 的 `CreateMilestoneAttrs` 接口：

```typescript
interface CreateMilestoneAttrs {
  track_id: string;
  title: string;
  description?: string;
  sort_order?: number;
  challenge_json?: string;
}
```

修改 `createMilestone` 函数的 INSERT：

```typescript
export function createMilestone(attrs: CreateMilestoneAttrs): Milestone {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(
    `INSERT INTO milestones (id, track_id, title, description, sort_order, status, challenge_json, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(id, attrs.track_id, attrs.title, attrs.description || "", attrs.sort_order || 0, attrs.challenge_json || null, now);
  return db.prepare("SELECT * FROM milestones WHERE id = ?").get(id) as Milestone;
}
```

- [ ] **Step 6: 编译验证 + Commit**

```bash
npx tsc --noEmit
```

期望：0 errors。

```bash
git add lib/utils/types.ts lib/db/index.ts lib/db/projects.ts lib/db/milestones.ts
git commit -m "feat(p8b): add types and DB schema for topic-project integration"
```

---

### Task 2: 积分引擎扩展 + 关联项目查询 API

**Files:**
- Modify: `lib/engine/points-engine.ts:13-30`
- Create: `app/api/topics/[id]/projects/route.ts`

**Interfaces:**
- Consumes: `ActionType` (含 create_project), `getProjectByTopic` from Task 1
- Produces: points engine 支持 create_project; GET /api/topics/[id]/projects 返回 `{ has_project, project_id? }`

- [ ] **Step 1: 扩展 points-engine.ts**

在 `lib/engine/points-engine.ts` 的 `DAILY_CAPS` 中追加：

```typescript
const DAILY_CAPS: Record<ActionType, number> = {
  login: 1,
  explore_topic: 3,
  complete_challenge: 5,
  task_done: 99,
  check_in: 3,
  reflection: 2,
  create_project: 3,
};
```

在 `POINTS_RULES` 中追加：

```typescript
const POINTS_RULES: Record<ActionType, { base: number; streakEligible: boolean }> = {
  login: { base: 5, streakEligible: false },
  explore_topic: { base: 10, streakEligible: false },
  complete_challenge: { base: 20, streakEligible: false },
  task_done: { base: 10, streakEligible: false },
  check_in: { base: 15, streakEligible: true },
  reflection: { base: 25, streakEligible: true },
  create_project: { base: 20, streakEligible: false },
};
```

- [ ] **Step 2: 创建 GET /api/topics/[id]/projects**

创建 `app/api/topics/[id]/projects/route.ts`：

```typescript
import { getTopic } from "@/lib/db/topics";
import { getProjectByTopic } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const project = getProjectByTopic(params.id);
  if (project) {
    return Response.json({ has_project: true, project_id: project.id });
  }
  return Response.json({ has_project: false });
}
```

- [ ] **Step 3: 编译验证 + Commit**

```bash
npx tsc --noEmit
```

期望：0 errors。

```bash
git add lib/engine/points-engine.ts app/api/topics/\[id\]/projects/route.ts
git commit -m "feat(p8b): add create_project to points engine and linked-project query API"
```

---

### Task 3: Start-Project API

**Files:**
- Create: `app/api/topics/[id]/start-project/route.ts`

**Interfaces:**
- Consumes: `getTopic`, `getActiveContent` from topics; `createProject`, `getProjectByTopic` from projects; `createTrack` from tracks; `createMilestone` from milestones; `createSession`, `createMessage` patterns from sessions/messages; `awardPoints` from points-engine; `getOrCreateAccount` from user-account; `addLog` from project-logs; `recordEvent` from evidence-collector
- Produces: `StartProjectResponse` (project + optional session)

- [ ] **Step 1: 研究现有依赖签名**

先确认以下模块导出（无需修改，仅确认签名）：

`lib/db/sessions.ts`:
```typescript
export function createSession(attrs: { title?: string; age_group?: string }): Session
```

`lib/db/messages.ts`:
```typescript
export function createMessage(attrs: { session_id: string; role: MessageRole; content: string; strategy_id?: string }): Message
```

`lib/db/tracks.ts`:
```typescript
export function createTrack(attrs: { project_id: string; name: string; type?: TrackType; sort_order?: number }): Track
```

`lib/db/topics.ts`:
```typescript
export function getTopic(id: string): TopicCatalog | undefined
export function getActiveContent(topicId: string, ageGroup: string, language: string): TopicContent | null
```

- [ ] **Step 2: 创建 route.ts**

创建 `app/api/topics/[id]/start-project/route.ts`：

```typescript
import { getTopic, getActiveContent } from "@/lib/db/topics";
import { createProject, getProjectByTopic } from "@/lib/db/projects";
import { createTrack } from "@/lib/db/tracks";
import { createMilestone } from "@/lib/db/milestones";
import { createSession } from "@/lib/db/sessions";
import { createMessage } from "@/lib/db/messages";
import { addLog } from "@/lib/db/project-logs";
import { recordEvent } from "@/lib/engine/evidence-collector";
import { awardPoints } from "@/lib/engine/points-engine";
import { getOrCreateAccount } from "@/lib/db/user-account";
import type { Challenge, TopicLanguage } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  // 1. Validate topic
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  // 2. Parse body
  const body = (await req.json().catch(() => ({}))) as {
    project_name?: string;
    goto?: "project" | "chat";
    language?: TopicLanguage;
  };
  const projectName = body.project_name?.trim() || topic.title;
  const goto = body.goto === "chat" ? "chat" : "project";
  const language: TopicLanguage = body.language || (topic.language as TopicLanguage);

  // 3. Get active content
  const content = getActiveContent(params.id, topic.age_group, language);
  if (!content) {
    return Response.json(
      { error: "no content generated for this topic" },
      { status: 400 }
    );
  }

  // 4. Check for existing project (idempotency)
  const existing = getProjectByTopic(params.id);
  if (existing) {
    // Return existing project — don't create duplicate
    return Response.json({ project: existing });
  }

  // 5. Always create a session (FK constraint + future chat support)
  // topic.age_group can be "all" — normalize to a valid AgeGroup
  const sessionAgeGroup: "6-9" | "10-12" | "13-15" =
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
```

- [ ] **Step 3: 编译验证 + Commit**

```bash
npx tsc --noEmit
```

期望：0 errors。

```bash
git add app/api/topics/\[id\]/start-project/route.ts
git commit -m "feat(p8b): add POST /api/topics/[id]/start-project conversion API"
```

---

### Task 4: StartProjectDialog 组件

**Files:**
- Create: `components/parent/start-project-dialog.tsx`

**Interfaces:**
- Consumes: `TopicCatalog`, `TopicContent`, `Challenge`, `StartProjectResponse`
- Produces: `<StartProjectDialog>` 组件，props: `topic`, `content`, `open`, `onClose`, `onSuccess`

- [ ] **Step 1: 创建组件**

创建 `components/parent/start-project-dialog.tsx`：

```typescript
"use client";

import { useState } from "react";
import type { TopicCatalog, TopicContent, Challenge, StartProjectResponse } from "@/lib/utils/types";

interface Props {
  topic: TopicCatalog;
  content: TopicContent;
  open: boolean;
  onClose: () => void;
  onSuccess: (result: StartProjectResponse) => void;
}

export function StartProjectDialog({ topic, content, open, onClose, onSuccess }: Props) {
  const [projectName, setProjectName] = useState(topic.title);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const challenges: Challenge[] = JSON.parse(content.challenges);

  const handleStart = async (goto: "project" | "chat") => {
    if (!projectName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/topics/${topic.id}/start-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: projectName.trim(), goto }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "创建项目失败，请稍后重试");
        setSubmitting(false);
        return;
      }
      const result: StartProjectResponse = await res.json();
      onSuccess(result);
    } catch {
      setError("网络连接失败，请检查网络后重试");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const difficultyLabel = (d: number): string =>
    d === 1 ? "★☆☆" : d === 2 ? "★★☆" : "★★★";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-card p-6 w-full max-w-md mx-4 shadow-lg space-y-4">
        {/* Title */}
        <div className="text-center">
          <div className="text-3xl mb-2">🚀</div>
          <h2 className="text-body-lg font-bold">开始一个新项目</h2>
        </div>

        {/* Project name input */}
        <div>
          <label className="text-body-sm text-ink-secondary block mb-1">项目名称</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised focus:border-primary focus:outline-none"
            placeholder="给你的项目起个名字"
            disabled={submitting}
          />
        </div>

        {/* Milestone preview */}
        <div>
          <p className="text-body-sm text-ink-secondary mb-2">📋 里程碑预览（来自挑战）</p>
          <div className="bg-surface-raised rounded-btn p-3 space-y-2 max-h-40 overflow-y-auto">
            {challenges.length === 0 ? (
              <p className="text-body-sm text-ink-tertiary text-center">暂无挑战</p>
            ) : (
              challenges.map((ch, i) => (
                <div key={i} className="flex items-center gap-2 text-body-sm">
                  <span className="text-ink-tertiary">{i + 1}.</span>
                  <span className="text-ink flex-1 truncate">{ch.title}</span>
                  <span className="text-body-xs text-ink-tertiary shrink-0">
                    {difficultyLabel(ch.difficulty)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-brand-soft border border-brand rounded-btn p-3">
            <p className="text-body-sm text-ink">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          <button
            onClick={() => handleStart("project")}
            disabled={submitting || !projectName.trim()}
            className="w-full bg-primary text-white border-none rounded-btn py-2.5 font-semibold text-body-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            📋 查看项目地图
          </button>
          <button
            onClick={() => handleStart("chat")}
            disabled={submitting || !projectName.trim()}
            className="w-full bg-surface border-2 border-primary text-primary rounded-btn py-2.5 font-semibold text-body-sm disabled:opacity-40 hover:bg-surface-raised transition-colors"
          >
            💬 和 K 一起梳理
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-full text-ink-tertiary text-body-sm py-1 hover:text-ink transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 编译验证 + Commit**

```bash
npx tsc --noEmit
```

期望：0 errors。注意：`StartProjectResponse` 类型已在 Task 1 定义。

```bash
git add components/parent/start-project-dialog.tsx
git commit -m "feat(p8b): add StartProjectDialog confirmation modal"
```

---

### Task 5: TopicDetail 集成

**Files:**
- Modify: `components/parent/topic-detail.tsx:240-251`

**Interfaces:**
- Consumes: `StartProjectDialog` from Task 4; `GET /api/topics/[id]/projects` from Task 2; `StartProjectResponse`
- Produces: 完整闭环——topic-detail 中"🚀 进入项目工坊"按钮实际可用

- [ ] **Step 1: 添加 import 和 state**

在 `components/parent/topic-detail.tsx` 的 import block 追加：

```typescript
import { StartProjectDialog } from "./start-project-dialog";
import { useRouter } from "next/navigation";
import type { StartProjectResponse } from "@/lib/utils/types";
```

在组件函数体顶部（第 27 行 `const pollRef` 之后）追加 state：

```typescript
const router = useRouter();
const [showStartDialog, setShowStartDialog] = useState(false);
const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
```

- [ ] **Step 2: 添加关联项目检测 effect**

在 `useEffect(() => { fetchContent(); }, [fetchContent]);` 之后（约第 58 行），追加：

```typescript
// Check for existing project linked to this topic
useEffect(() => {
  fetch(`/api/topics/${topic.id}/projects`)
    .then(r => r.json())
    .then(d => {
      if (d.has_project) setLinkedProjectId(d.project_id);
    })
    .catch(() => {});
}, [topic.id]);
```

- [ ] **Step 3: 修改按钮逻辑**

替换第 240-251 行的 project cta section：

```typescript
{/* Project cta */}
{content.project_prompt && (
  <section className="bg-surface border border-border rounded-card p-5 text-center">
    <p className="text-body-sm text-ink-secondary mb-3">{content.project_prompt}</p>
    {linkedProjectId ? (
      <button
        onClick={() => router.push(`/projects/${linkedProjectId}`)}
        className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm hover:opacity-90 transition-opacity"
      >
        📋 查看项目
      </button>
    ) : (
      <button
        onClick={() => setShowStartDialog(true)}
        className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm hover:opacity-90 transition-opacity"
      >
        🚀 进入项目工坊
      </button>
    )}
  </section>
)}
```

- [ ] **Step 4: 添加弹窗和成功回调**

在 `</div>` 闭合之前（return 语句末尾，约第 254 行），追加：

```typescript
{/* Start project dialog */}
{content && (
  <StartProjectDialog
    topic={topic}
    content={content}
    open={showStartDialog}
    onClose={() => setShowStartDialog(false)}
    onSuccess={(result: StartProjectResponse) => {
      setShowStartDialog(false);
      setLinkedProjectId(result.project.id);
      if (result.session) {
        router.push(`/?session=${result.session.id}`);
      } else {
        router.push(`/projects/${result.project.id}`);
      }
    }}
  />
)}
```

- [ ] **Step 5: 编译验证 + Commit**

```bash
npx tsc --noEmit
```

期望：0 errors。

```bash
git add components/parent/topic-detail.tsx
git commit -m "feat(p8b): wire StartProjectDialog into topic-detail with project detection"
```

---

## 验证清单

全部任务完成后：

```bash
# Type check
npx tsc --noEmit

# Full build (确保新路由被 Next.js 识别)
npm run build

# 手动测试流程
# 1. 访问 /explore → 选话题 → 点"开始探索" → 等生成
# 2. 点"🚀 进入项目工坊" → 确认弹窗出现 → 编辑项目名
# 3. 选"📋 查看项目地图" → 跳转 /projects/[id] → 看到 milestones
# 4. 回到 /explore → 同话题 → 按钮变为"📋 查看项目"
# 5. 再测"💬 和 K 一起梳理" → 跳转聊天页 → 看到种子消息
```
