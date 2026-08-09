# Kid-Aider P8a · 习惯养成体系 — 设计规格

> 日期：2026-08-10
> 状态：设计完成

## 目标

在已有项目级打卡基础上，建立全局习惯养成体系：用户账号、每日行为积分、12 枚分级徽章、段位排名，让孩子通过积分量化和徽章收集建立持续使用动力。

---

## 1. 数据模型

### 1.1 user_account

```sql
CREATE TABLE IF NOT EXISTS user_account (
  id              TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL DEFAULT '小小探索者',
  avatar_emoji    TEXT DEFAULT '🧒',
  age_group       TEXT NOT NULL DEFAULT '10-12',
  language        TEXT NOT NULL DEFAULT 'zh-CN',
  total_points    INTEGER NOT NULL DEFAULT 0,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

> 单用户本地模式：表永远只有一条记录。GET 时自动创建，无 POST。

### 1.2 daily_activity

```sql
CREATE TABLE IF NOT EXISTS daily_activity (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  action_type     TEXT NOT NULL,
  action_target   TEXT,
  points          INTEGER NOT NULL,
  note            TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON daily_activity(user_id, created_at);
```

> `action_type`: `"login"` | `"explore_topic"` | `"complete_challenge"` | `"task_done"` | `"check_in"` | `"reflection"`

### 1.3 badge_def

```sql
CREATE TABLE IF NOT EXISTS badge_def (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  icon            TEXT NOT NULL,
  category        TEXT NOT NULL,
  rarity          TEXT NOT NULL DEFAULT 'common',
  points_value    INTEGER NOT NULL DEFAULT 0,
  unlock_rule     TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL
);
```

> `category`: `"explore"` | `"project"` | `"streak"` | `"special"`
> `rarity`: `"common"` | `"rare"` | `"epic"` | `"legendary"`
> `unlock_rule`: JSON, e.g. `{"type":"action_count","threshold":10,"subject":"explore_topic"}`

### 1.4 badge_unlock

```sql
CREATE TABLE IF NOT EXISTS badge_unlock (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  badge_id        TEXT NOT NULL REFERENCES badge_def(id),
  unlocked_at     TEXT NOT NULL,
  UNIQUE(user_id, badge_id)
);
```

---

## 2. 积分经济

### 2.1 积分规则

| 行为 | action_type | 积分 | 每日上限 | 连击加成 |
|---|---|---|---|---|
| 每日登录 | login | +5 | 1 次 | — |
| 阅读话题内容 | explore_topic | +10 | 3 次 | — |
| 完成互动挑战 | complete_challenge | +20 | 5 次 | — |
| 项目任务打卡 | check_in | +15 | 3 次 | 连击≥7天：×1.5 |
| 写复盘反思 | reflection | +25 | 2 次 | 连击≥7天：×1.5 |
| 获得新徽章 | — | +徽章自身分值 | — | — |

> 每日上限按 `(user_id, action_type, date)` 统计当日已有次数判定，超过则不追加积分。

### 2.2 连击判定

- 基于 `daily_activity` 最新记录的日期：
  - 昨天有任意活动记录 → 今天首次活动时 `current_streak + 1`
  - 昨天无记录 → `current_streak` 重置为 1
  - 每次更新 `current_streak` 时同步 `longest_streak = max(longest_streak, current_streak)`

### 2.3 同一天重复去重

同一 `(user_id, action_type, date)` 只保留首次记录。`POST /api/user/activity` 中通过查询当日同类型记录数判定是否超过上限。

---

## 3. 徽章体系

### 3.1 探索类（explore）

| id | 名称 | 解锁条件 | 稀有度 | 分值 |
|---|---|---|---|---|
| badge-explore-01 | 初来乍到 | 首次登录 | common | 10 |
| badge-explore-02 | 好奇宝宝 | 阅读 10 个话题 | common | 20 |
| badge-explore-03 | 博学少年 | 阅读 50 个话题 | rare | 50 |
| badge-explore-04 | 实验达人 | 完成 20 个挑战 | rare | 50 |

### 3.2 项目类（project）

| id | 名称 | 解锁条件 | 稀有度 | 分值 |
|---|---|---|---|---|
| badge-project-01 | 初次启航 | 创建第一个项目 | common | 15 |
| badge-project-02 | 建造大师 | 完成 5 个项目 | rare | 60 |
| badge-project-03 | 任务克星 | 完成 50 个任务 | epic | 100 |
| badge-project-04 | 反思者 | 写 10 条复盘 | rare | 40 |

### 3.3 连击类（streak）

| id | 名称 | 解锁条件 | 稀有度 | 分值 |
|---|---|---|---|---|
| badge-streak-01 | 三日之约 | 连续 3 天 | common | 10 |
| badge-streak-02 | 七日行者 | 连续 7 天 | rare | 40 |
| badge-streak-03 | 月之守护 | 连续 30 天 | epic | 150 |
| badge-streak-04 | 百日传奇 | 连续 100 天 | legendary | 500 |

### 3.4 解锁检测

每次 `awardPoints()` 调用后自动运行 `checkBadges(userId)`：
- 查询全部 `badge_def`
- 过滤出用户未解锁的
- 对每个未解锁徽章，根据 `unlock_rule` 检查是否满足条件
- 满足 → 写入 `badge_unlock` + 追加积分奖励
- 返回新解锁的徽章列表 `new_badges[]`

---

## 4. 段位体系

| 段位 | 积分区间 | 称号 | 模拟排名语 |
|---|---|---|---|
| 🥉 bronze | 0-100 | 探索新手 | "你超过了 30% 的探索者" |
| 🥈 silver | 101-500 | 知识学徒 | "你超过了 55% 的探索者" |
| 🥇 gold | 501-2000 | 智慧达人 | "你超过了 80% 的探索者" |
| 💎 diamond | 2001-5000 | 博学大师 | "你超过了 95% 的探索者" |
| 👑 legendary | 5001+ | 传奇探索家 | "你在所有探索者中名列前茅" |

> P8d 部署后，模拟排名替换为真实社区排行榜。

---

## 5. API 路由

### 5.1 账号

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/user/account` | GET | 获取当前账号（无则自动创建） |
| `/api/user/account` | PUT | 更新名称、头像、语言偏好 |

### 5.2 活动与积分

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/user/activity` | GET | `{ today_points, streak, activities[] }` |
| `/api/user/activity` | POST | 记录行为 `{ action_type, action_target? }` → 返回 `{ points_awarded, new_badges[], streak_updated }` |
| `/api/user/stats` | GET | `{ total_points, current_streak, longest_streak, rank_tier, next_tier, badges_count, total_topics, total_challenges, total_projects }` |

### 5.3 徽章

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/user/badges` | GET | `{ unlocked: BadgeUnlock[], all: BadgeDef[] }` |
| `/api/user/badges/check` | POST | 手动触发徽章检测 → `{ new_badges[] }` |

### 5.4 排行榜

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/leaderboard` | GET | 本地模式：`{ mode: "local", rank_tier, rank_text, next_tier, points_to_next }` |

### 5.5 积分触发点（修改现有路由）

| 现有路由 | 追加行为 |
|---|---|
| `POST /api/topics/[id]/generate` | 生成后 `awardPoints("explore_topic")` |
| `POST /api/projects/[id]/check-in` | 打卡后 `awardPoints("check_in")` |
| `POST /api/projects/[id]/reflect` | 复盘后 `awardPoints("reflection")` |

> 触发统一走 `lib/engine/points-engine.ts` 的 `awardPoints(userId, actionType, target?)`，内部处理上限、连击、徽章检测。

### 5.6 客户端积分触发

探索页完成挑战后在 `topic-detail.tsx` 中 POST `/api/user/activity` → `complete_challenge`。

---

## 6. UI 扩展

### 6.1 `/me` 页面

页面路由：`app/me/page.tsx`

布局：
- **UserCard** — 头像 emoji + 可编辑名称（点击弹出输入框）、段位徽章、段位进度条、连击天数
- **DailySummary** — 今日活动列表（图标 + 描述 + 积分 + 连击加成标记）、今日合计
- **BadgeCollection** — 徽章网格：已解锁彩色展示、未解锁灰色 + 进度百分比
- **RankCard** — 段位信息 + 模拟排名语 + 距下一段位剩余分数

### 6.2 导航入口

`app/page.tsx` 导航栏在 🔍 探索之前插入 👤 我的链接。

### 6.3 新徽章祝贺

`components/chat/bubble-guide.tsx` — 当 POST activity 返回 `new_badges` 时，小K 自动发送祝贺气泡。

### 6.4 组件清单

| 组件 | 文件 |
|---|---|
| UserCard | `components/me/user-card.tsx` |
| DailySummary | `components/me/daily-summary.tsx` |
| BadgeCollection | `components/me/badge-collection.tsx` |
| RankCard | `components/me/rank-card.tsx` |

### 6.5 修改现有组件

| 组件 | 修改内容 |
|---|---|
| `app/page.tsx` | 导航栏新增 👤 我的 |
| `app/api/projects/[id]/check-in/route.ts` | 追加 `awardPoints()` |
| `app/api/projects/[id]/reflect/route.ts` | 追加 `awardPoints()` |
| `app/api/topics/[id]/generate/route.ts` | 追加 `awardPoints()` |
| `components/parent/topic-detail.tsx` | 完成挑战后 POST activity |
| `components/chat/bubble-guide.tsx` | 新徽章祝贺气泡 |

---

## 7. 不修改

- 聊天界面（BubbleGuide / BubbleChild）
- SSE 架构
- P1-P7 所有现有功能（积分触发是追加式 side-effect）
- 现有 badges 表（保留兼容，不删除）

---

## 8. 边缘情况

| 场景 | 处理 |
|---|---|
| 首次使用，无账号 | GET `/api/user/account` 自动创建默认账号 |
| 同一天重复登录 | `(user_id, "login", date)` 已存在 → 不重复计分 |
| 跨天自动连击 | 基于 `daily_activity` 最近日期判定：昨天有 → +1；无 → 重置为 1 |
| 徽章自动检测 | 每次 `awardPoints()` → `checkBadges()` → 自动解锁 + 追加奖励分 |
| 卸载重装 | SQLite 文件丢失 → 积分清零（P8d 可绑定账号恢复） |
| 完全离线 | 积分、徽章、段位全部本地计算，排名为本地模拟 |
| P7 内容层无用户概念 | P8a 只加不破 |

---

## 9. 全局约束

- **零新增 npm 依赖** — 积分、排名纯自实现
- **不改变现有 SSE 架构** — 活动记录是同步追加
- **TypeScript strict，无 `any`**
- **遵循项目 token 设计系统** — /me 页面复用 Tailwind 类
- **P7 内容层不受影响** — side-effect 追加不改核心逻辑
- **单用户本地优先** — user_account 永远一条记录，直到 P8d 引入多用户
- **所有路由文件 must include `export const dynamic = "force-dynamic"`**
- **DB 访问通过 `import { getDb } from "./index"`** 获取实例
- **ID 使用 uuid v4，时间戳格式 `new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")`**
