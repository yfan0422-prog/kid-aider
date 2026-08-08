# Kid-Aider P3 · 成长可见 — 设计文档

> 版本：v1.0
> 日期：2026-08-08
> 基于：[P2 项目工坊设计](2026-08-08-kid-aider-p2-design.md) | [Kid-Aider 产品设计](../../../kid-aider_design.md)

---

## 1. 目标

P2 让孩子有了项目执行能力。P3 让成长的轨迹"被看见"——孩子看到自己的进步获得激励，家长看到数据建立信任。P3 不新增引导或执行流程，而是基于 P1+P2 积累的行为数据构建"成长层"。

### 核心用户路径

```
孩子侧：
  成长面板 /growth
  ├── 六维雷达图（能力画像）
  ├── 徽章墙（已获得 vs 未解锁）
  └── 趋势线（能力变化）

  作品墙 /showcase
  └── 已完成项目卡片画廊 + 精选置顶

家长侧：
  报告页 /report
  ├── 能力雷达图
  ├── 趋势折线图（可选维度）
  ├── 项目摘要
  └── 导出 PDF
```

---

## 2. 分龄设计

| 维度 | 6-9 岁 | 10-12 岁 | 13-15 岁 |
|------|--------|----------|----------|
| 雷达图标签 | 大字 + emoji | 标准标签 | 标准标签 |
| 徽章获得提示 | 全屏动画 + 音效 | 弹窗 + 动画 | 简洁弹窗 |
| 能力评语 | "太棒了！你能说清楚自己想要什么！" | "你的需求表达越来越清晰了" | "需求澄清能力稳步提升" |
| 报告措辞 | 对家长说明为主 | 对家长 + 孩子 | 孩子可自读 |

---

## 3. 六维能力模型

| 维度 | 标识 | 定义 | 评分方式 |
|------|------|------|---------|
| 需求澄清力 | clarification | 能否清晰表达想要什么、区分"想要"和"需要"、细化模糊想法 | AI 定性 |
| 分解力 | decomposition | 能否把大目标拆成小步骤、步骤之间逻辑是否合理 | AI 定性 |
| 执行力 | execution | 任务完成率、打卡频率 | 规则引擎 |
| 反思力 | reflection | 复盘回答是否具体（不是"挺好的"）、能否指出困难、有改进想法 | AI 定性 |
| 创造力 | creativity | 方案想法多样性、是否有原创性、是否尝试不同角度 | AI 定性 |
| 坚持力 | persistence | 项目持续天数、中断后恢复次数 | 规则引擎 |

---

## 4. 数据模型（新增 3 张表）

```sql
-- 能力快照（每周一条，每维度一条记录）
CREATE TABLE competency_snapshots (
  id          TEXT PRIMARY KEY,
  week_start  TEXT NOT NULL,  -- 周一日期 YYYY-MM-DD
  dimension   TEXT NOT NULL CHECK(dimension IN (
                'clarification','decomposition','execution',
                'reflection','creativity','persistence'
              )),
  score       INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  score_type  TEXT NOT NULL CHECK(score_type IN ('rule','ai')),
  evidence    TEXT NOT NULL DEFAULT '[]',  -- JSON: [{source_table, source_id, quote, weight}]
  created_at  TEXT NOT NULL,
  UNIQUE(week_start, dimension)
);

-- 证据事件（每次行为发生时写入，AI 和规则引擎的共同数据源）
CREATE TABLE evidence_events (
  id           TEXT PRIMARY KEY,
  dimension    TEXT NOT NULL,
  event_type   TEXT NOT NULL,  -- funnel_complete | task_done | check_in | reflection_submit | project_complete | project_resume | ...
  source_table TEXT NOT NULL,  -- sessions | tasks | check_ins | reflections | projects | solution_packs | requirement_nodes
  source_id    TEXT NOT NULL,
  payload      TEXT NOT NULL DEFAULT '{}',  -- JSON: 上下文数据
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_evidence_dimension ON evidence_events(dimension);
CREATE INDEX idx_evidence_created ON evidence_events(created_at);

-- 徽章
CREATE TABLE badges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,   -- 如 "decomposition-silver"
  label       TEXT NOT NULL,   -- 中文名 "小拆分家"
  tier        TEXT NOT NULL CHECK(tier IN ('silver','gold')),
  dimension   TEXT,            -- 关联维度（能力徽章）或 NULL（成就徽章）
  category    TEXT NOT NULL CHECK(category IN ('competency','achievement')),
  description TEXT NOT NULL,   -- 获得条件描述
  icon        TEXT NOT NULL,   -- emoji
  earned_at   TEXT,            -- 获得时间，NULL 表示未获得
  created_at  TEXT NOT NULL
);
```

### 索引

```sql
CREATE INDEX idx_snapshots_week ON competency_snapshots(week_start);
CREATE INDEX idx_evidence_dimension ON evidence_events(dimension);
CREATE INDEX idx_evidence_created ON evidence_events(created_at);
CREATE INDEX idx_badges_dimension ON badges(dimension);
CREATE INDEX idx_badges_earned ON badges(earned_at);
```

---

## 5. 评分引擎

### 5.1 规则引擎公式（执行力 / 坚持力）

```
执行力 = min(100, 任务完成率×60 + 打卡率×40)
  任务完成率 = done_tasks / total_tasks × 100
  打卡率 = check_in_days / active_days × 100

坚持力 = min(100, 持续天数分 + 恢复分)
  持续天数分 = min(60, active_days / 7 × 10)  // 每周最多 10 分，封顶 60
  恢复分 = min(40, resume_count × 10)          // 每次恢复 10 分，封顶 40
```

### 5.2 AI 定性评估（澄清力 / 分解力 / 反思力 / 创造力）

四个维度使用统一 prompt 模板，传入不同维度名和证据上下文：

```
你是 Kid-Aider 的{维度名}评估教练。
根据以下孩子的行为数据，给出 0-100 的评分。

评分标准：
- 需求澄清力：能否清晰表达想要什么、能区分"想要"和"需要"、能否细化模糊想法
- 分解力：能否把大目标拆成小步骤、步骤之间逻辑是否合理
- 反思力：回答是否具体（不是"挺好的"）、能否指出具体困难、是否有改进想法
- 创造力：想法是否多样、是否有原创性、是否尝试不同角度

数据：
{该维度相关的 evidence_events JSON}

返回 JSON：
{
  "score": 0-100,
  "summary": "一段对孩子说的话（50字以内，鼓励为主）",
  "evidence": [
    {"quote": "来自数据的原句引用", "source": "表名.字段名", "weight": "high|medium|low"}
  ]
}
```

每条 evidence 必须有可追溯的原句引用——证据链要求。

### 5.3 调度策略

- 按周生成快照。前端访问成长面板时检查最新快照是否覆盖本周：
  - 若落后 + 本周有新 evidence_events → 触发快照生成 → 写入 `competency_snapshots`
  - 若无新事件 → 跳过 AI 评估，节省 token
- AI 调用走 `routeModel("dialogue")` → `adapter.chat({ temperature: 0.3 })`
- 非流式调用，需完整 JSON 解析

### 5.4 证据采集器 `lib/engine/evidence-collector.ts`

```
各模块在行为发生时调用 collector：

- 漏斗完成 → funnel_complete → clarification
- 方案包生成 → solution_generated → creativity
- 任务完成 → task_done → execution
- 每日打卡 → check_in → execution
- 复盘提交 → reflection_submit → reflection
- 项目完成 → project_complete → persistence
- 项目恢复 → project_resume → persistence
- 需求节点创建 → requirement_created → clarification
```

---

## 6. 徽章系统

### 6.1 徽章列表（共 15 枚）

**能力徽章（6 维 × 2 层级 = 12 枚）：**

| 维度 | 银徽章（≥60 分持续 2 周） | 金徽章（≥80 分持续 4 周） |
|------|--------------------------|---------------------------|
| 需求澄清力 | 🎯 清晰表达者 | 🏅 需求大师 |
| 分解力 | 🧩 小拆分家 | 🏅 分解大师 |
| 执行力 | ⚡ 行动派 | 🏅 执行达人 |
| 反思力 | 💭 思考者 | 🏅 反思之星 |
| 创造力 | ✨ 创意火花 | 🏅 创造大师 |
| 坚持力 | 🌱 坚持者 | 🏅 毅力冠军 |

**成就徽章（3 枚）：**

| 徽章 | 条件 | 类型 |
|------|------|------|
| 🚀 首次完成 | 完成第一个项目 | 一次性 |
| 📅 21天挑战 | 连续打卡 21 天 | 一次性 |
| 🔄 卷土重来 | 恢复暂停项目 3 次以上 | 一次性 |

### 6.2 获得流程

```
competency-scorer 写入新快照
  → badge-evaluator 检查所有 earned_at IS NULL 的徽章
    → 条件满足 → UPDATE badges SET earned_at = now()
    → 返回新获得徽章列表
      → 前端弹窗庆祝（全屏动画，可关闭）
```

### 6.3 徽章初始化

P3 首次加载时插入 15 条徽章定义（earned_at = NULL），后续只更新 earned_at，不新增/删除记录。

---

## 7. 作品墙

### 7.1 页面布局

```
┌──────────────────────────────────────────────┐
│  🌟 我的作品墙                                │
│                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ ★ 精选  │ │  项目B   │ │  项目C   │        │
│  │ 项目A   │ │  📅 15天 │ │  📅 8天  │        │
│  │ ⭐⭐⭐  │ │  ✅ 12  │ │  ✅ 5   │        │
│  │ 🥇×3   │ │  🥈×1   │ │          │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  [+ 置为精选]  [取消精选]                      │
└──────────────────────────────────────────────┘
```

### 7.2 逻辑

- 已完成项目（status = completed）自动出现在作品墙
- 每张卡片展示：标题、耗时天数、完成任务数、该项目期间获得的徽章
- 精选状态存 `localStorage`（纯前端偏好），最多 2 个精选，精选卡片带 ★ 标记和边框高亮
- 无分页——孩子项目量不大，网格排列即可
- 数据来源：复用现有 `projects` 表，无需新增后端

---

## 8. 家长报告

### 8.1 页面布局

```
┌─────────────────────────────────────────────────┐
│  📊 成长报告                        [导出 PDF]   │
│                                                   │
│  时间范围: [最近4周 ▼]                             │
│                                                   │
│  ┌─ 能力雷达图 ─┐  ┌─ 趋势折线图 ──────────────┐  │
│  │    需求澄清   │  │ 100│        ···执行力      │  │
│  │    /‾‾‾\     │  │  80│    ···              │  │
│  │   /     \    │  │  60│···                  │  │
│  │  分解 · 执行 │  │  40│                      │  │
│  │   \     /    │  │  20│  第1周 第2周 第3周    │  │
│  │    \___/     │  └──────────────────────────┘  │
│  │  反思   坚持  │                                │
│  │    创造力    │  ┌─ 项目摘要 ─────────────────┐  │
│  └─────────────┘  │ 已完成 3 个，进行中 1 个     │  │
│                   │ 总任务完成率 78%              │  │
│                   │ 获得徽章 5 枚                 │  │
│                   └─────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 8.2 图表实现

- **雷达图**：纯 SVG，无额外依赖。从 `competency_snapshots` 读最新一周数据，六轴 0-100 刻度
- **趋势线**：多线折线图，SVG 实现。X 轴为周次，Y 轴 0-100。可选显示/隐藏维度（默认全显示）
- **时间范围**：最近 4 周 / 最近 8 周 / 全部，默认最近 4 周

### 8.3 PDF 导出

浏览器端方案，零额外依赖：

```
点击导出 → 打开隐藏 iframe 渲染纯报告 HTML → window.print() → 系统打印对话框 → 另存为 PDF
```

配合 `@media print` CSS 隐藏导航/按钮，仅保留报告内容。

---

## 9. API 设计

| 方法 | 端点 | 用途 |
|------|------|------|
| `GET` | `/api/competency` | 获取最新能力数据（6 维快照） |
| `POST` | `/api/competency` | 触发快照生成 `{ action: "snapshot" }` |
| `GET` | `/api/badges` | 获取全部徽章（含 earned_at） |
| `GET` | `/api/badges?earned=true` | 获取已获得徽章 |
| `POST` | `/api/badges/check` | 手动触发徽章检查，返回新获得的徽章列表 |
| `GET` | `/api/report?weeks=4` | 获取报告数据（快照 + 摘要） |
| `GET` | `/api/report?export=pdf` | 返回可打印的 HTML 报告 |

### 关键请求/响应

**GET /api/competency**
```
响应：{
  snapshots: [{ dimension, score, score_type, evidence, week_start }],
  latest_week: "2026-08-03",
  trends: [{ week_start, scores: { clarification: N, ... } }]  // 最近 8 周
}
```

**POST /api/competency { action: "snapshot" }**
```
逻辑：收集本周 evidence_events → 规则引擎计算 execution/persistence
  → AI 评估其余 4 维 → 写入 competency_snapshots
响应：{ snapshots: [...], new_badges: [...] }
```

**GET /api/badges**
```
响应：{
  badges: [{ id, name, label, tier, dimension, category, description, icon, earned_at }],
  earned_count: 5,
  total_count: 15
}
```

**POST /api/badges/check**
```
逻辑：读取最新快照 + 事件 → 检查所有 unearned 徽章条件 → 更新达标者
响应：{ new_badges: [{ id, label, icon }] }  // 空数组 = 无新徽章
```

**GET /api/report?weeks=4**
```
响应：{
  time_range: { start: "2026-07-14", end: "2026-08-08" },
  snapshots: [{ week_start, scores: {...} }],
  summary: {
    total_projects: 4,
    completed_projects: 3,
    total_tasks_done: 47,
    task_completion_rate: 0.78,
    badges_earned: 5,
    current_streak: 12
  }
}
```

---

## 10. 前端路由与组件

### 路由

```
/growth        → 成长面板（雷达图 + 徽章墙 + 趋势线）
/showcase      → 作品墙（已完成项目卡片画廊）
/report        → 家长报告（雷达图 + 趋势 + 项目摘要 + PDF 导出）
```

### 组件树

```
app/growth/page.tsx
├── RadarChart            # SVG 六维雷达图
├── BadgeWall
│   └── BadgeCard[]       # 单个徽章（已获得=彩色，未获得=灰度）
└── TrendLine             # SVG 能力趋势折线图

app/showcase/page.tsx
├── ShowcaseGrid
│   └── ProjectShowcaseCard[]  # 已完成项目卡片（含徽章、天数、任务数）
└── FeaturedToggle        # 精选/取消精选（localStorage）

app/report/page.tsx
├── TimeRangeSelector     # 4周/8周/全部
├── RadarChart            # 复用
├── TrendLine             # 复用（含维度显示/隐藏开关）
├── ProjectSummary        # 项目统计摘要
└── ExportButton           # 触发 window.print()
```

### 关键交互

| 组件 | 交互行为 |
|------|----------|
| **RadarChart** | 静态 SVG；hover 某维度显示分数和 AI 评语；六轴标准刻度 0-100 |
| **BadgeCard** | 已获得：彩色 + 获得日期 tooltip；未获得：灰度 + 条件提示 |
| **BadgeWall** | 分组展示（按维度 + 成就），新获得徽章弹全屏庆祝动画 |
| **TrendLine** | 可选显示/隐藏维度线；hover 某周显示各维度具体分数 |
| **ProjectShowcaseCard** | 卡片展示项目标题/天数/任务数/徽章；精选卡片高亮 + ★ 标记 |
| **ExportButton** | 点击 → 打开 iframe → window.print() → 系统打印对话框 |
| **TimeRangeSelector** | 下拉选择，切换后重新请求 report API |

---

## 11. 数据流

### 11.1 事件采集

```
行为发生（task done / check-in / reflection / ...）
  → 业务模块调用 evidence-collector.record(dimension, event_type, source, payload)
  → 写入 evidence_events 表
```

### 11.2 快照生成

```
前端访问 /growth
  → GET /api/competency
    → 检查最新 snapshots 的 week_start 是否覆盖当前周
      → 落后 + 有新 events → POST /api/competency { action: "snapshot" }
        → 收集本周 evidence_events
        → 规则引擎：execution + persistence
        → AI 评估：clarification + decomposition + reflection + creativity
        → 写入 6 条 competency_snapshots
        → badge-evaluator 检查 + 更新 badges
        → 返回 snapshots + new_badges
  → 前端渲染雷达图 + 徽章墙
  → 如有新徽章 → 庆祝动画
```

### 11.3 报告查看

```
前端访问 /report
  → GET /api/report?weeks=4
    → 读取指定周数 competency_snapshots
    → 聚合项目统计数据
    → 返回 snapshots + summary
  → 前端渲染雷达图 + 趋势线 + 摘要
```

---

## 12. 新增模块清单

```
lib/engine/evidence-collector.ts    # 行为证据采集（各模块调用）
lib/engine/competency-scorer.ts     # 能力评分引擎（规则 + AI）
lib/engine/badge-evaluator.ts       # 徽章评定引擎
lib/engine/report-generator.ts      # 报告摘要生成
lib/db/competency-snapshots.ts      # 能力快照 CRUD
lib/db/evidence-events.ts           # 证据事件 CRUD
lib/db/badges.ts                    # 徽章 CRUD
lib/store/growth-store.ts           # 成长面板 Zustand store
app/growth/page.tsx                 # 成长面板
app/showcase/page.tsx               # 作品墙
app/report/page.tsx                 # 家长报告
components/growth/radar-chart.tsx   # SVG 六维雷达图
components/growth/badge-wall.tsx    # 徽章展示墙
components/growth/badge-card.tsx    # 单枚徽章
components/growth/trend-line.tsx    # SVG 能力趋势折线图
components/showcase/project-showcase-card.tsx  # 作品卡片
app/api/competency/route.ts         # 能力数据 API
app/api/badges/route.ts             # 徽章 API
app/api/report/route.ts             # 报告 API
```

---

## 13. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 图表库 | 纯 SVG 自绘 | 数据量小（6 维 + 数周趋势），避免引入依赖 |
| AI 评估 | 非流式 `adapter.chat()` | 需完整 JSON 解析，流式无优势 |
| 评分粒度 | 每周一次 | 评的是能力成长，不需要天级精度 |
| 徽章初始数据 | P3 首次加载时 INSERT 15 条 | 徽章定义稳定，不需要动态管理 |
| 精选项目 | localStorage | 纯前端偏好，无需后端 |
| PDF 导出 | `window.print()` | 零依赖，打印对话框即可另存为 PDF |
| 雷达图/趋势图 | 组件级复用 | `/growth` 和 `/report` 共享 RadarChart + TrendLine |
| 事件采集时机 | 各业务模块主动调用 collector | 解耦——collector 不侵入业务逻辑 |
| 新增依赖 | 无 | 全部基于现有技术栈 |

---

## 14. 与 P2 的衔接

| P2 产出 | P3 消费方式 |
|---------|------------|
| tasks 表 | 任务完成 → evidence_events (execution) |
| check_ins 表 | 打卡记录 → evidence_events (execution) |
| reflections 表 | 复盘内容 → evidence_events (reflection) |
| project_logs 表 | 日志 → evidence_events 上下文 payload |
| projects 表 | 完成项目 → 作品墙数据源 / evidence_events (persistence) |
| solution_packs 表 | 方案生成 → evidence_events (creativity) |
| requirement_nodes 表 | 需求表达 → evidence_events (clarification) |
| 分龄配置 (age-config) | 复用 `getAgeConfig` 控制评语措辞和徽章展示 |

### P2 需补充的埋点

P3 的 evidence_events 依赖各业务模块在行为发生时写入事件。P2 的以下 API 需要在完成操作后追加 `evidence-collector.record()` 调用：

| P2 API | 新增调用 |
|--------|---------|
| `POST /api/tasks/[id]/done` | `collector.record("task_done", ...)` |
| `POST /api/projects/[id]/check-in` | `collector.record("check_in", ...)` |
| `POST /api/projects/[id]/reflect` | `collector.record("reflection_submit", ...)` |
| `POST /api/projects` (创建) | `collector.record("project_created", ...)` |
| `PUT /api/projects/[id]` (完成/恢复) | `collector.record("project_complete" / "project_resume", ...)` |

以及 P1 的以下端点：
| `POST /api/chat` (漏斗完成) | `collector.record("funnel_complete", ...)` |
| `POST /api/solution` (方案生成) | `collector.record("solution_generated", ...)` |

---

## 15. 不在 P3 范围内

- 实时推送 / WebSocket 通知（徽章获得后只是当前页面弹窗）
- 多孩子账号管理（P6 做）
- 语音交互（P5 做）
- 云端同步（P6 做）
- 社交分享（不在路线图中）
- 家长控制面板 / 项目管理权限（P4 做）

---

*文档结束。下一步：编写 P3 实现计划。*
