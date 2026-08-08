# Kid-Aider P2 · 项目工坊 — 设计文档

> 版本：v1.0
> 日期：2026-08-08
> 基于：[P1 MVP 设计](2026-08-07-kid-aider-dev-plan.md) | [Kid-Aider 产品设计](../../../kid-aider_design.md)

---

## 1. 目标

孩子拿到 P1 方案包后，Kid-Aider 作为全程"项目经理"陪伴孩子把方案包转化为可执行的项目，分多天完成，每次回来记得进度。P2 让 Kid-Aider 从"一次性引导工具"升级为"持续性项目陪伴工具"。

### 核心用户路径

```
方案包 → 开始项目 → AI 自动拆解 → 对话调整确认 → 开始执行
                                                        │
              ┌─────────────────────────────────────────┘
              ▼
    ┌──────────────────────────────────────┐
    │              项目主页                  │
    │  ┌──────────┐  ┌──────────┐          │
    │  │ 轨道 A   │  │ 轨道 B   │   ...     │
    │  │ 软件编程  │  │ DIY 制作 │          │
    │  │ ████░░ 80%│  │ ██░░░ 40%│         │
    │  └──────────┘  └──────────┘          │
    │  下次任务：测试传感器                   │
    │  AI 回顾："上次你完成了..."             │
    └──────────────────────────────────────┘
       │                │              │
       ▼                ▼              ▼
   任务打卡          每日总结        复盘流程
   (✅点击完成)    (今天做了什么)   (每日轻量/
       │                             里程碑深度/
       ▼                             总复盘四问)
   日历热力图
   连续活跃激励
```

---

## 2. 分龄设计

| 维度 | 6-9 岁 | 10-12 岁 | 13-15 岁 |
|------|--------|----------|----------|
| 任务粒度 | 每 milestone ≤2 task，每个约 15 分钟 | ≤4 task | ≤5 task |
| 语气 | 多 emoji，简短句 | 友好但理智 | 接近成人教练 |
| 复盘措辞 | "今天你做了什么呀？" | "这个阶段你完成了哪些事情？" | 同 10-12 |
| 打卡激励 | 每 3 天解锁徽章 | 每 7 天解锁徽章 | 每 7 天解锁徽章 |
| 续接语长 | ≤3 句 | ≤4 句 | ≤5 句 |

---

## 3. 数据模型（新增 SQLite 表）

```sql
-- 项目
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  session_id  TEXT REFERENCES sessions(id),
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | paused | completed
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 轨道（一个项目可有多条轨道）
CREATE TABLE tracks (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'software',  -- software | diy
  sort_order  INTEGER DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL
);

-- 里程碑（每条轨道下的阶段目标）
CREATE TABLE milestones (
  id          TEXT PRIMARY KEY,
  track_id    TEXT NOT NULL REFERENCES tracks(id),
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order  INTEGER DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | active | done
  completed_at TEXT,
  created_at  TEXT NOT NULL
);

-- 可打卡任务
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  milestone_id  TEXT NOT NULL REFERENCES milestones(id),
  title         TEXT NOT NULL,
  what_to_do    TEXT NOT NULL,
  how_hint      TEXT DEFAULT '',
  difficulty    INTEGER DEFAULT 1,  -- 1-3
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | active | done
  completed_at  TEXT,
  created_at    TEXT NOT NULL
);

-- 每日打卡/总结
CREATE TABLE check_ins (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  date        TEXT NOT NULL,  -- YYYY-MM-DD，per-project 唯一
  summary     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE(project_id, date)
);

-- 复盘记录
CREATE TABLE reflections (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id),
  type         TEXT NOT NULL,  -- daily | milestone | final
  trigger_ref  TEXT,           -- milestone_id 或 null
  q1           TEXT DEFAULT '',
  q2           TEXT DEFAULT '',
  q3           TEXT DEFAULT '',
  q4           TEXT DEFAULT '',
  created_at   TEXT NOT NULL
);

-- 活动日志
CREATE TABLE project_logs (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  action      TEXT NOT NULL,  -- task_done | check_in | reflection | milestone_complete | track_complete
  detail      TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
```

### 索引

```sql
CREATE INDEX idx_tracks_project ON tracks(project_id);
CREATE INDEX idx_milestones_track ON milestones(track_id);
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX idx_check_ins_project_date ON check_ins(project_id, date);
CREATE INDEX idx_reflections_project ON reflections(project_id);
CREATE INDEX idx_project_logs_project ON project_logs(project_id);
```

---

## 4. API 设计

| 方法 | 端点 | 用途 |
|------|------|------|
| `POST` | `/api/projects` | 从 session 方案包创建项目 + AI 自动拆解 |
| `GET` | `/api/projects` | 项目列表（按 updated_at 倒序） |
| `GET` | `/api/projects/[id]` | 项目详情（含 tracks/milestones/tasks） |
| `PUT` | `/api/projects/[id]` | 更新项目（对话调整拆解） |
| `DELETE` | `/api/projects/[id]` | 删除项目及所有关联数据 |
| `POST` | `/api/projects/[id]/tracks` | 添加轨道 |
| `DELETE` | `/api/projects/[id]/tracks/[trackId]` | 删除轨道 |
| `POST` | `/api/tasks/[id]/done` | 任务打卡（toggle done/undo） |
| `POST` | `/api/projects/[id]/check-in` | 每日打卡 + 一句话总结 |
| `POST` | `/api/projects/[id]/reflect` | 触发复盘（body: { type, trigger_ref? }） |
| `GET` | `/api/projects/[id]/resume` | 智能续接上下文 |

### 关键请求/响应

**POST /api/projects**
```
请求：{ sessionId: string }
响应：{ project: { id, title, tracks: [{ id, name, type, milestones: [{ id, title, tasks: [...] }] }] } }
逻辑：读取 solution_packs(latest) → 关键词分轨 → project-decomposer LLM 拆解 → 写入所有表 → 返回完整结构
```

**POST /api/tasks/[id]/done**
```
请求：无 body（toggle 行为）
响应：{ task: { id, status, completed_at }, milestone_complete: bool, project_complete: bool }
逻辑：翻转 task.status → 写 project_log → 检查所属 milestone 是否全部 done → 检查所属 project 是否全部 done
```

**POST /api/projects/[id]/check-in**
```
请求：{ summary: string }
响应：{ check_in: { id, date, summary }, streak: { current: number, longest: number } }
逻辑：upsert 今日 check_in → 写 project_log → 计算连续打卡天数
```

**POST /api/projects/[id]/reflect**
```
请求：{ type: "daily"|"milestone"|"final", trigger_ref?: string }
响应：{ reflection: { id, type, q1-q4 }, questions: [{ id, text, hint }] }
逻辑：reflection-coach 构建个性化问题 → 返回问题列表 → 回答后写入 reflections 表
```

**GET /api/projects/[id]/resume**
```
请求：无
响应：{ resume_text: string, next_task: Task|null, days_since_last_activity: number, streak: number }
逻辑：读取最近 3 条 logs + check_ins → resume-builder LLM 生成续接文本
```

---

## 5. 前端路由与组件

### 路由

```
/projects              → 项目列表页
/projects/[id]          → 项目详情页（含轨道列/打卡日历/复盘入口）
```

### 组件树

```
app/projects/
├── page.tsx                    # 项目列表
│   └── ProjectList
│       └── ProjectCard[]       # 项目摘要卡片
│
└── [id]/page.tsx               # 项目详情
    ├── ResumeBlock             # 智能续接（顶部气泡）
    ├── TrackBoard
    │   └── TrackColumn[]       # 每条轨道一列
    │       └── MilestoneGroup[]
    │           └── TaskCard[]  # 可打卡任务卡片
    ├── CalendarHeatmap         # 打卡热力图
    ├── CheckInDialog           # 每日总结弹窗
    ├── ReflectionDialog        # 复盘四问弹窗（分步展开）
    └── StreakBadge             # 连续打卡徽章
```

### 关键交互

| 组件 | 交互行为 |
|------|----------|
| **TaskCard** | 点击 ✅ → instant 动画勾选 → API → 刷新进度条；已完成的 task 可点击撤销 |
| **TrackColumn** | 垂直滚动；milestone 完成时整行高亮 + 小彩蛋动画；活跃 milestone 有脉冲光圈 |
| **CheckInDialog** | 弹窗 textarea → 确认后日历即时刷新 + 连续天数更新 |
| **ReflectionDialog** | 分 4 步逐步展开（降低认知负荷）；可跳过任一问题；完成后展示"复盘卡片" |
| **ResumeBlock** | 进入页面调用 resume API；打字机动画呈现 |
| **CalendarHeatmap** | GitHub 风格；hover 显示当日总结；点击展开详情 |
| **StreakBadge** | 3/7/14/30 天解锁；达标弹庆祝动画 |

---

## 6. 引擎模块

### 6.1 项目拆解引擎 `lib/engine/project-decomposer.ts`

```
输入：方案包 YAML 全文 + 孩子年龄段
输出：{ tracks: [{ name, type, milestones: [{ title, tasks: [{ title, what_to_do, how_hint, difficulty }] }] }] }

年龄适配：
- 6-9：每 milestone ≤2 task，每个约 15 分钟
- 10-12：每 milestone ≤4 task
- 13-15：每 milestone ≤5 task

轨道自动识别：
- plan.steps 含 代码/编程/Arduino/网页/app/游戏 → software
- plan.steps 含 材料/搭建/组装/焊接/测量/画图 → diy
- 未识别 → 默认一条 "通用" 轨道

how_hint 规则：不给答案，给线索。如"提示：想想 if 语句怎么判断湿度是否太高"
difficulty 分布：总体 1 占 ~30%，2 占 ~50%，3 占 ~20%（先易后难）
```

### 6.2 智能续接引擎 `lib/engine/resume-builder.ts`

```
输入：项目 title + 年龄段 + 最近 3 条 logs + 最近 check_ins + 下一个 undone task + 距上次活动天数 + 连续打卡天数
输出：纯文本（前端渲染到气泡）

语气模板：
1. 回顾：上次你{action}，已经连续{days}天打卡了
2. 如果 >1 天没来：{gap_days}天没见，欢迎回来
3. 引导：接下来要{next_task.title}（{next_task.how_hint}）
4. 如果 check_in 中提过困难：上次你说{困难}，今天想试试吗？
5. 如果连续 >5 天：加上特别鼓励

长度限制：6-9≤3句/10-12≤4句/13-15≤5句。6-9 多 emoji
```

### 6.3 复盘教练引擎 `lib/engine/reflection-coach.ts`

```
输入：项目上下文 + 年龄段 + 复盘类型 (daily/milestone/final) + trigger_ref + 最近 logs
输出：{ questions: [{ id, text, hint }], context_note: string }

分龄措辞：
         6-9 岁                    10-15 岁
Q1   "今天做了什么呀？"          "这{阶段/项目}完成了哪些事？"
Q2   "有什么觉得难的吗？"         "遇到的最大挑战是什么？怎么解决的？"
Q3   "学会了什么新本领？"         "学到了什么？如果可以重来会怎么做？"
Q4   "接下来想做什么呀？"         "下一步计划？需要什么帮助？"

context_note：基于已完成 task 的具体名称（≤3 个），如"今天完成了水泵控制代码和传感器测试"
```

---

## 7. 数据流

### 7.1 方案包 → 项目转化

```
POST /api/projects { sessionId }
  → 读取 solution_packs (latest version for session)
  → 提取 plan.steps → 按关键词分轨道
  → project-decomposer LLM 拆解
  → 返回完整 project JSON
  → 前端渲染确认页 → 对话调整 → 锁定
```

### 7.2 打卡 → 里程碑 → 项目完成

```
task done → 更新 task status + project_log
  → 检查所属 milestone 是否全部 done
    → 是：milestone 标记完成 + project_log + 弹窗提示复盘
  → 检查所属 project 所有 milestone 是否全部 done
    → 是：project 标记 completed + project_log + 弹窗提示总复盘
```

### 7.3 智能续接

```
页面加载 → GET /api/projects/[id]/resume
  → resume-builder 构建 prompt
  → LLM 生成续接文本
  → 前端打字机动画渲染
  → 同时高亮下一个 undone task
```

---

## 8. 与 P1 的衔接

| P1 产出 | P2 消费方式 |
|---------|------------|
| 方案包 (solution_packs) | `POST /api/projects` 读取 latest version 作为拆解输入 |
| 需求节点 (requirement_nodes) | 拆解 prompt 中引用，保持需求追溯 |
| 会话 (sessions) | projects.session_id 关联来源会话 |
| 分龄配置 (age-config) | 复用 `getAgeConfig` 控制 task 粒度、语气 |
| 模型路由 (model-router) | 复用 `routeModel("dialogue")` 做拆解/续接/复盘 LLM 调用 |
| Zustand store | 扩展 `useChatStore` 或新建 `useProjectStore` |

---

## 9. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 项目 store | 新建 `useProjectStore`（Zustand） | 项目状态独立于对话，避免 store 膨胀 |
| 拆解 LLM 调用 | 非流式 `adapter.chat()` | 拆解结果需完整 JSON，流式无优势 |
| 续接 LLM 调用 | 非流式 | 文本短（≤5 句），流式开销大于收益 |
| 复盘问题生成 | 非流式 | 返回 JSON，需完整解析 |
| 日历热力图 | 自绘（CSS Grid） | 避免引入图表库，数据量小（最多 365 天） |
| 动画 | CSS transition + keyframes | 不需要额外动画库，徽章动画用纯 CSS |
| 新增依赖 | 无 | 全部基于现有技术栈 |

---

## 10. 不在 P2 范围内

- 家长面板 / 报告导出（P3 做）
- 能力画像 / 徽章系统（P3 做）
- 语音交互（P5 做）
- 云端同步 / 多设备（P6 做）
- 社交分享 / 作品墙（P3 做）
- 项目模板市场（不在路线图中）

---

*文档结束。下一步：编写 P2 实现计划。*
