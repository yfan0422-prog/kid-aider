# Kid-Aider P8b · 内容-项目集成 — 设计规格

> 日期：2026-08-10
> 状态：设计完成（已确认）

## 目标

打通 P7 内容生态与 P2 项目工坊的完整闭环：孩子在探索页浏览话题、生成内容、完成挑战后，一键将话题转化为项目，选择进入项目地图或聊天引导继续梳理需求。

---

## 1. 核心流程

```
探索页 → 生成内容 → 完成挑战(积分)
                        │
                        ▼
              点击"🚀 进入项目工坊"
                        │
                        ▼
              ┌─ 确认弹窗 ──────────────┐
              │ 项目名: 话题标题 (可编辑) │
              │ 挑战 → 里程碑预览        │
              │                         │
              │ [📋 查看项目地图]        │
              │ [💬 和 K 一起梳理]      │
              └─────────────────────────┘
               /                      \
              ▼                        ▼
     POST /api/topics           POST /api/topics
     /[id]/start-project        /[id]/start-project
     + 跳转 /projects/[id]      + 创建 session
                                + 跳转 / (聊天页)
```

---

## 2. 数据模型变更

### 2.1 projects 表（新增 2 列）

```sql
ALTER TABLE projects ADD COLUMN source TEXT DEFAULT 'funnel';
ALTER TABLE projects ADD COLUMN source_topic_id TEXT;
```

- `source`: `"funnel"` (P1 漏斗创建) | `"topic"` (P8b 话题转化)
- `source_topic_id`: 追溯来源话题 ID，用于 topic-detail 判断是否已关联项目

### 2.2 milestones 表（新增 2 列）

```sql
ALTER TABLE milestones ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE milestones ADD COLUMN challenge_json TEXT;
```

- `description`: 里程碑说明（来自 challenge.description）
- `challenge_json`: 原始 challenge 对象的 JSON 序列化，包含 hint / materials / difficulty / estimated_minutes

---

## 3. 新增 API

### 3.1 POST `/api/topics/[id]/start-project`

**请求体：**
```json
{
  "project_name": "我的智能浇花装置",
  "goto": "project" | "chat",
  "language": "zh-CN"
}
```

- `language` 用于 `getActiveContent` 查对应语言版本的内容，默认取 topic.language

**响应体：**
```json
{
  "project": {
    "id": "proj-xxx",
    "title": "我的智能浇花装置",
    "source": "topic",
    "source_topic_id": "topic-xxx"
  },
  "session": {
    "id": "sess-xxx"
  }
}
```

**后端流程：**
1. getTopic(params.id) — 不存在返回 404
2. getActiveContent(params.id, topic.age_group, language) — 无内容返回 400
3. 解析 content.challenges → Challenge[]
4. createProject({ title: project_name, source: "topic", source_topic_id: topic.id })
5. createTrack({ project_id, name: "默认轨道", type: "software" })
6. 每条 challenge → createMilestone({ track_id, title: ch.title, description: ch.description, challenge_json: JSON.stringify(ch) })
7. 如果 goto === "chat"：createSession({ title: project_name }) + 插入首条 guide 消息（project_prompt 种子文本） + 插入首条 system 消息（里程碑列表上下文）
8. awardPoints(account.id, "create_project", topic.id)
9. addLog(project.id, "task_done", `从话题"${topic.title}"创建项目`)
10. recordEvent("creativity", "project_created_from_topic", ...)

**错误处理：**

| 场景 | 状态码 | 响应 |
|---|---|---|
| 话题不存在 | 404 | `{ error: "topic not found" }` |
| 话题无生成内容 | 400 | `{ error: "no content generated for this topic" }` |
| 项目名称为空 | 422 | `{ error: "project_name is required" }` |
| 内部错误 | 500 | `{ error: "failed to create project" }` |

---

## 4. 类型扩展

### 4.1 新增 ActionType

```typescript
export type ActionType =
  | "login"
  | "explore_topic"
  | "complete_challenge"
  | "task_done"
  | "check_in"
  | "reflection"
  | "create_project";  // ← 新增
```

### 4.2 新增接口

```typescript
export interface StartProjectRequest {
  project_name: string;
  goto: "project" | "chat";
  language?: TopicLanguage;
}

export interface StartProjectResponse {
  project: Project;
  session?: { id: string };  // 仅 goto="chat" 时有值
}
```

### 4.3 Project 类型扩展

```typescript
export type ProjectSource = "funnel" | "topic";

export interface Project {
  // ... existing fields ...
  source: ProjectSource;
  source_topic_id: string | null;
}
```

### 4.4 Milestone 类型扩展

```typescript
export interface Milestone {
  // ... existing fields ...
  description: string;
  challenge_json: string | null;
}
```

---

## 5. 积分规则扩展

| 行为 | action_type | 积分 | 每日上限 |
|---|---|---|---|
| 从话题创建项目 | create_project | +20 | 3 次 |

在 `lib/engine/points-engine.ts` 的 `DAILY_CAPS` 中新增 `create_project: 3`。

---

## 6. UI 变更

### 6.1 确认弹窗（新组件 `components/parent/start-project-dialog.tsx`）

```
┌─────────────────────────────────────┐
│  🚀 开始一个新项目                   │
│                                     │
│  项目名称                            │
│  ┌─────────────────────────────────┐│
│  │ 我的智能浇花装置                  ││  ← 默认 topic.title，可编辑
│  └─────────────────────────────────┘│
│                                     │
│  📋 里程碑预览（来自挑战）            │
│  ┌─────────────────────────────────┐│
│  │ ⭐ 设计浇水电路       难度 ★★   ││
│  │ ⭐ 编写控制程序       难度 ★★★  ││
│  │ ⭐ 测试和调试         难度 ★★   ││
│  └─────────────────────────────────┘│
│                                     │
│       [📋 查看项目地图]              │
│       [💬 和 K 一起梳理]             │
└─────────────────────────────────────┘
```

Props:
- `topic: TopicCatalog`
- `content: TopicContent`
- `open: boolean`
- `onClose: () => void`
- `onSuccess: (result: StartProjectResponse) => void`

### 6.2 TopicDetail 按钮逻辑变更

- 已有项目（`GET /api/topics/[id]/projects` 查到关联项目）：按钮变"📋 查看项目"，点击跳转 `/projects/[id]`
- 无项目：显示"🚀 进入项目工坊"，点击打开 StartProjectDialog

### 6.3 修改文件清单

| 文件 | 变更 |
|---|---|
| `components/parent/topic-detail.tsx` | 禁用 TODO 按钮，接入 StartProjectDialog；已关联项目跳转 |
| `components/parent/start-project-dialog.tsx` | **新建** — 确认弹窗 |
| `app/api/topics/[id]/start-project/route.ts` | **新建** — 核心转化 API |
| `app/api/topics/[id]/projects/route.ts` | **新建** — 查询话题关联项目 |
| `lib/db/projects.ts` | createProject 扩展 source/source_topic_id + getProjectByTopic |
| `lib/db/milestones.ts` | createMilestone 扩展 description/challenge_json |
| `lib/db/index.ts` | ALTER TABLE 新增字段 |
| `lib/utils/types.ts` | 新增类型 + 扩展 Project/Milestone |
| `lib/engine/points-engine.ts` | DAILY_CAPS 新增 create_project: 3 |

---

## 7. 聊天种子消息

当孩子选择"💬 和 K 一起梳理"时，系统创建 session 并插入两条初始消息：

**guide 消息（project_prompt 种子）：**
```
太好了！你已经开始了一个关于"{topic.title}"的项目 🎉

{content.project_prompt}

让我们一起来把它想得更清楚！你可以问我任何关于这个项目的知识问题，或者让我帮忙把下一步想得更具体。
```

**system 消息（里程碑上下文）：**
```
当前项目已有里程碑：
{for each milestone: - {m.title}（难度: {"⭐".repeat(m.difficulty)}, 预计 {m.estimated_minutes} 分钟）}
```

引导引擎照常运作——不改变引擎逻辑，只提供初始上下文。

---

## 8. 已关联项目检测

新增轻量查询（在 topic-detail 渲染时调用）：

```
GET /api/topics/[id]/projects → { has_project: boolean, project_id?: string }
```

通过 `SELECT id FROM projects WHERE source_topic_id = ? AND source = 'topic' ORDER BY created_at DESC LIMIT 1` 实现。

---

## 9. 边缘情况

| 场景 | 处理 |
|---|---|
| 话题无生成内容 | "🚀 进入项目工坊"按钮不渲染 |
| 话题已关联项目 | 按钮变"📋 查看项目"，直接跳转 |
| 项目名留空 | 输入框不可为空，空时确认按钮 disabled |
| challenges 为空数组 | 仅建 project+track，无 milestone，弹窗预览区显示"暂无挑战" |
| 内容有多个版本 | 取 is_active=1 的最新版本 |
| 选择"💬 梳理"但对话模型不可用 | 降级：跳转项目详情页 + toast "对话服务暂不可用，已为你创建项目地图" |
| projects 表 source/source_topic_id 列为 NULL | 旧项目 source 为 `"funnel"`（DEFAULT 值），source_topic_id 为 NULL——迁移安全 |

---

## 10. 不修改

- 对话引导引擎（funnel-machine / intent / prompt-builder）—— seed 消息以数据注入，不改变引擎逻辑
- 方案包/漏斗流程
- SSE 架构
- 内容生成引擎（content-generator）
- 探索页框架与路由
- 项目工坊核心 CRUD
- 打卡/复盘/续接

---

## 11. 全局约束

- **零新增 npm 依赖** — 全部自实现
- **不改变 SSE 架构** — 对话照常运作
- **TypeScript strict，无 `any`**
- **遵循项目 Tailwind token 设计系统**
- **P1-P8a 所有现有功能不受影响**
- **P8a 积分系统 side-effect 追加**
- **所有新路由 `export const dynamic = "force-dynamic"`**
- **DB 访问通过 `import { getDb } from "./index"`**
- **ID 使用 uuid v4**
- **时间戳格式 `new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")`**
