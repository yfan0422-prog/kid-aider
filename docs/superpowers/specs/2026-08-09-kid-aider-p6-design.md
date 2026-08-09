# Kid-Aider P6 · 智能进化 — 设计规格

> 日期：2026-08-09
> 状态：设计完成

## 目标

利用 P1-P5 积累的对话记录、情绪日志、能力评分、项目历史等数据，构建自适应策略引擎。让"小K"的对话风格和引导策略随孩子的能力成长、情绪模式、兴趣变化而动态调整——**不改变现有交互链路，画像信息在后端注入提示词，对终端用户（孩子）不可见。**

---

## 1. 数据模型

### 1.1 child_profile

```sql
CREATE TABLE IF NOT EXISTS child_profile (
  id                TEXT PRIMARY KEY,
  -- 能力维度 (from competency_snapshots)
  ability_creativity    REAL DEFAULT 0.5,
  ability_logical       REAL DEFAULT 0.5,
  ability_focus         REAL DEFAULT 0.5,
  ability_expression    REAL DEFAULT 0.5,
  ability_curiosity     REAL DEFAULT 0.5,
  ability_updated_at    TEXT,
  -- 兴趣偏好 (from messages + projects, JSON)
  interest_tags         TEXT DEFAULT '[]',
  interest_updated_at   TEXT,
  -- 情绪基线 (from emotion_log, JSON)
  emotion_baseline      TEXT DEFAULT '{}',
  emotion_updated_at    TEXT,
  -- 交互模式
  preferred_time_range  TEXT,
  avg_session_minutes   REAL,
  engagement_trend      TEXT DEFAULT 'stable',
  -- 元数据
  total_sessions        INTEGER DEFAULT 0,
  last_session_at       TEXT,
  deep_analysis_at      TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 1.2 profile_updates

```sql
CREATE TABLE IF NOT EXISTS profile_updates (
  id            TEXT PRIMARY KEY,
  trigger       TEXT NOT NULL CHECK(trigger IN ('session_start', 'session_end', 'deep_analysis')),
  changes       TEXT NOT NULL,
  snapshot      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**设计要点：**
- 不新增对 P1-P5 表的写入——画像表是纯读取聚合，不影响现有链路
- `interest_tags` 和 `emotion_baseline` 用 JSON 存储，避免 `ALTER TABLE` 频繁加列
- 所有能力维度初始值 0.5，渐进更新
- 画像数据仅影响提示词策略，删除画像表后系统回退到 P5 行为

---

## 2. 画像更新流水线

两级更新机制：实时轻量更新 + 定期深度分析。

```
[孩子发消息]
    │
    ├──→ /api/chat (修改)
    │    ├─ 文本 → rule 情绪分类 (已有)
    │    ├─ 【新增】读取 child_profile → 注入策略提示词
    │    └─ SSE 流式回复
    │
    └──→ 【新增】session_end 轻量更新
         ├─ 更新交互计数 + 最后会话时间
         └─ 每 N 次会话后，标记 deep_analysis 待触发

[定时/阈值触发]
    │
    └──→ 【新增】/api/profile/analyze
         ├─ 从 competency_snapshots 重新计算能力分
         ├─ 从 emotion_log 重新计算情绪基线
         ├─ 从 messages 提取新兴趣关键词
         ├─ 计算 engagement_trend
         ├─ 写入 child_profile
         └─ 追加 profile_updates 记录
```

### 触发时机

| 触发器 | 何时 | 更新范围 | 是否阻塞 |
|--------|------|---------|---------|
| `session_start` | 每次 chat 收到第一条消息 | 读取画像 → 注入 prompt | 是 (O(1) DB 读) |
| `session_end` | 每次会话结束后 (消息>3 条时) | 更新计数、时间 | 否 (fire-and-forget) |
| `deep_analysis` | 每 5 次会话后 + 距上次 >24h | 全量重新计算 | 否 (后台异步) |

### 新增/修改文件

| 文件 | 操作 | 职责 |
|------|------|------|
| `lib/engine/profile-builder.ts` | 新建 | 画像计算引擎 |
| `lib/db/child-profile.ts` | 新建 | child_profile + profile_updates CRUD |
| `app/api/profile/route.ts` | 新建 | GET 读取当前画像 |
| `app/api/profile/analyze/route.ts` | 新建 | POST 触发深度分析 |
| `app/api/chat/route.ts` | 修改 | 注入画像读取 + 轻量更新 |
| `lib/engine/prompt-builder.ts` | 修改 | 新增 profileContext 参数 |
| `lib/db/index.ts` | 修改 | 新增建表语句 |

---

## 3. 策略自适应

### 3.1 提示词注入

修改 `buildChatPrompt()`，在系统提示词中插入动态画像上下文：

```
系统提示词结构（修改后）：

┌──────────────────────────────────────────┐
│ [角色定义] 你是小K，活泼温暖的AI伙伴...      │  ← 不变
├──────────────────────────────────────────┤
│ [画像上下文] 当前孩子状态：                  │  ← 新增
│   - 能力：创造力▁▃▅ 逻辑力▁▂▃ 专注力▁▁▂... │
│   - 兴趣：绘画、恐龙                        │
│   - 情绪趋势：近 5 次对话偏兴奋型             │
│   - 互动节奏：平均专注 8 分钟，建议每 5 分钟   │
│     插入一次互动确认                         │
├──────────────────────────────────────────┤
│ [年龄配置] 6-8岁，语言简单...               │  ← 不变
├──────────────────────────────────────────┤
│ [情绪上下文] 孩子当前情绪：excited            │  ← P5 已有
├──────────────────────────────────────────┤
│ [引导策略] ...                              │  ← 不变
├──────────────────────────────────────────┤
│ [对话历史] ...                              │  ← 不变
└──────────────────────────────────────────┘
```

### 3.2 适应规则

| 画像信号 | 触发条件 | 策略调整 |
|---------|---------|---------|
| 某能力分 < 0.3 | 能力明显弱项 | 降低该领域任务复杂度，主动给提示 |
| 某能力分 > 0.7 | 能力明显强项 | 增加挑战度，减少干预 |
| engagement_trend = "declining" | 连续 3 次情绪低落或消息数减少 | 切换轻松话题，建议换项目方向 |
| avg_session_minutes < 3 | 专注时长短 | 加快引导节奏，减少单次信息量 |
| 兴趣标签匹配到当前话题 | 孩子正在聊感兴趣的东西 | 增加延伸提问，利用兴趣驱动 |
| 情绪基线 frustrated > 0.3 | 孩子整体偏沮丧 | 多用鼓励语气，降低任务密度 |

---

## 4. API 路由

### 新增

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/profile` | GET | 读取当前 child_profile，返回 `{ profile, lastDeepAnalysis }` |
| `/api/profile/analyze` | POST | 触发深度分析，异步执行，返回 `{ status: "started" }` |

### 修改

| 路由 | 改动点 |
|------|--------|
| `/api/chat` | 消息处理前读取画像 → 传入 prompt builder；会话结束后触发轻量更新；每 5 次会话标记 deep analysis |

---

## 5. UI 扩展

### 5.1 画像卡片 · `components/parent/profile-view.tsx`

家长面板新增：

- 能力雷达图（复用现有 RadarChart 组件）
- 兴趣标签云（Tags 展示）
- 情绪趋势简述
- 互动统计（总对话次数、平均时长、最近活跃时间）
- 深度分析按钮（手动触发）

修改文件：
- `components/parent/profile-view.tsx` — 新建
- `app/parent/page.tsx` — 在 Tab 列表中新增"能力画像"

### 5.2 不修改

- 聊天界面：画像对孩子不可见，通过 prompt 隐形生效
- BubbleGuide / BubbleChild：无需改动

---

## 6. 边缘情况与错误处理

| 场景 | 处理 |
|------|------|
| 首次使用无历史数据 | 所有能力返回默认 0.5，兴趣标签为空，策略退化到现有机模式 |
| 深度分析进行中，再次触发 | 检查 deep_analysis_at，距上次 < 6h 返回 `"skipped"` |
| 情绪数据不足以计算基线 | 要求 ≥ 10 条 emotion_log 才更新，不足则保留旧值 |
| engagement_trend 无法判定 | 会话数 < 10 时默认为 "stable"，不干预策略 |
| 深度分析计算失败 | try/catch + 错误日志，保留旧画像不变 |
| 画像数据缺失（表首次创建） | `getOrCreateChildProfile` 幂等创建默认行 |

---

## 7. 全局约束

- **零新增 npm 依赖** — 计算逻辑纯 TypeScript，无外部库
- **不改变现有 SSE 架构** — 画像读取是 O(1) DB 查询，在 prompt 构建前完成
- **TypeScript strict，无 `any`**
- **遵循项目 token 设计系统**
- **异步分析不阻塞用户交互** — 深度分析用 fire-and-forget
- **画像数据仅影响提示词策略，不改变现有数据流** — 删除画像表后系统回退到 P5 行为
