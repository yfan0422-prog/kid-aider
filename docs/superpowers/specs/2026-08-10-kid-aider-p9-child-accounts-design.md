# Kid-Aider P9 · 多子账号管理 — 设计规格

> 日期：2026-08-10
> 状态：设计确认（待审阅）

## 目标

家长在设置页创建、编辑、删除孩子档案，不同孩子拥有完全独立的数据空间（对话历史、项目、成长、积分、徽章）。孩子通过头像选择进入自己的空间，不同设备可独立选择当前活跃孩子。无需密码认证。

---

## 1. 用户模型与数据流

### 核心逻辑

```
家长在设置页 → 创建/编辑/删除孩子档案
                     ↓
首页导航栏 → 孩子切换器（头像下拉）
                     ↓
选择孩子 → 存入 localStorage + URL 参数 ?child_id=
                     ↓
所有页面/API → 按 child_id 过滤数据
```

### 跨设备行为

| 场景 | 行为 |
|---|---|
| 首次打开（无记录） | 显示孩子选择页 |
| 已有记录（同设备） | localStorage 恢复上次选择，直接进入 |
| 新设备/新浏览器 | 独立选择，不影响其他设备 |
| 不同设备选同一孩子 | 各自正常使用，数据共享同一 child_id |
| 不同设备选不同孩子 | 各自独立数据空间 |

### 孩子档案字段

复用并扩展 `user_account` 表：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK UUID | 唯一标识（即 child_id） |
| `display_name` | TEXT | 显示名，"小小探索者" |
| `avatar_emoji` | TEXT | 头像 emoji，"🧒" |
| `age_group` | TEXT | 年龄段，"6-9" / "10-12" / "13-15" |
| `language` | TEXT | 语言偏好，"zh-CN" / "zh-HK" / "en" |
| `total_points` | INTEGER | 总积分（按 child_id 累加） |
| `current_streak` | INTEGER | 当前连续天数 |
| `longest_streak` | INTEGER | 最长连续天数 |
| `created_at` | TEXT ISO | 创建时间 |
| `updated_at` | TEXT ISO | 更新时间 |

---

## 2. 数据库变更

### 2.1 策略

所有存储孩子数据的表加 `child_id TEXT` 列，通过索引加速查询。共享配置表保持不变。

### 2.2 需加 child_id 的表（16 张）

#### 核心数据表 — 直接加列

| 表 | 加列 | 索引 | 查询变化 |
|---|---|---|---|
| `sessions` | `child_id TEXT NOT NULL DEFAULT ''` | `idx_sessions_child` | `WHERE child_id = ?` |
| `messages` | 不加列，通过 session 关联 | — | JOIN sessions 获取 child_id |
| `requirement_nodes` | 不加列，通过 session 关联 | — | 同上 |
| `solution_packs` | 不加列，通过 session 关联 | — | 同上 |
| `projects` | `child_id TEXT NOT NULL DEFAULT ''` | `idx_projects_child` | `WHERE child_id = ?` |
| `tracks` | 不加列，通过 project 关联 | — | JOIN projects 获取 child_id |
| `milestones` | 不加列，通过 track 关联 | — | 同上 |
| `tasks` | 不加列，通过 milestone 关联 | — | 同上 |
| `check_ins` | 不加列，通过 project 关联 | — | JOIN projects 获取 child_id |
| `reflections` | 不加列，通过 project 关联 | — | 同上 |
| `project_logs` | 不加列，通过 project 关联 | — | 同上 |
| `voice_sessions` | `child_id TEXT NOT NULL DEFAULT ''` | `idx_voice_child` | `WHERE child_id = ?` |
| `emotion_log` | `child_id TEXT NOT NULL DEFAULT ''` | `idx_emotion_child` | `WHERE child_id = ?` |

#### 单用户模式表 — 从固定 ID 改为 child_id

| 表 | 当前 | 改造 |
|---|---|---|
| `child_profile` | `id = "default"` 硬编码 | 加 `child_id TEXT NOT NULL`，去掉 `DEFAULT_ID` |
| `profile_updates` | 无隔离 | 加 `child_id TEXT NOT NULL` |
| `competency_snapshots` | 无隔离 | 加 `child_id TEXT NOT NULL` |
| `evidence_events` | 无隔离 | 加 `child_id TEXT NOT NULL` |

### 2.3 保持不变的表（7 张）

| 表 | 原因 |
|---|---|
| `model_profiles` | 系统级模型配置 |
| `topic_catalog` | 共享内容目录 |
| `topic_contents` | 共享内容 |
| `topic_suggestions` | 系统生成建议 |
| `badge_def` | 徽章定义（共享） |
| `filtered_words` | 敏感词（共享） |
| `usage_config` | 暂共享，后续可改为 per-child |
| `usage_log` | 暂共享 |
| `badges` (legacy) | 后续可废弃或加 child_id |

### 2.4 已有 user_id 无需改动的表（3 张）

| 表 | 说明 |
|---|---|
| `daily_activity` | `user_id` 列已在，即 child_id |
| `badge_unlock` | `user_id` 列已在，即 child_id |
| `user_account` | 本身就是账户表 |

### 2.5 迁移

```sql
-- 对存量数据：所有 child_id = '' 的行归属到默认第一个用户
UPDATE sessions SET child_id = ? WHERE child_id = '';
UPDATE projects SET child_id = ? WHERE child_id = '';
UPDATE voice_sessions SET child_id = ? WHERE child_id = '';
UPDATE emotion_log SET child_id = ? WHERE child_id = '';
-- ... 其余新加列的表同理
```

迁移在首次启动时自动执行，以 `user_account` 第一行作为默认归属目标。

---

## 3. API 改造

### 3.1 获取当前孩子

前端每次 API 请求通过 URL 查询参数传递 `child_id`：

```
GET /api/user/account?child_id=uuid-xxx
POST /api/user/activity?child_id=uuid-xxx
GET /api/chat?child_id=uuid-xxx
POST /api/chat?child_id=uuid-xxx   （SSE 流也包含 child_id）
```

### 3.2 API 路由改造模式

```
改造前:
  const account = getOrCreateAccount()    // LIMIT 1，永远返回唯一行

改造后:
  const childId = searchParams.child_id
  if (!childId) return error(400, "child_required")
  const account = getAccount(childId)     // WHERE id = ?
```

### 3.3 账户 CRUD API

| 方法 | 路由 | 说明 |
|---|---|---|
| `GET` | `/api/user/accounts` | 列出所有孩子 |
| `POST` | `/api/user/accounts` | 创建新孩子 |
| `PUT` | `/api/user/accounts?id=xxx` | 更新孩子信息 |
| `DELETE` | `/api/user/accounts?id=xxx` | 删除孩子及所有关联数据 |

### 3.4 DB 函数签名变更

```typescript
// lib/db/user-account.ts

// 旧（移除）
getOrCreateAccount(): UserAccount

// 新
listAccounts(): UserAccount[]                      // 所有孩子
createAccount(name: string, avatar: string, age: string, lang: string): UserAccount
updateAccount(id: string, fields: Partial<UserAccount>): UserAccount
deleteAccount(id: string): void
getAccount(id: string): UserAccount | null
```

### 3.5 child_id 缺失时的行为

| 场景 | 响应 |
|---|---|
| 页面路由（无 child_id） | 服务端渲染，无数据，前端显示选择页 |
| API 路由（无 child_id） | 返回 `400 { error: "child_required" }` |
| SSE 聊天流（无 child_id） | 返回 `400`，不建立连接 |

---

## 4. UI 改造

### 4.1 孩子选择页

无 child_id 时显示（首次使用或 localStorage 无记录）：

- 路由：`/select`（无 `child_id` 时自动跳转）
- 已有孩子：头像 + 名字 + 年龄，点击进入
- ＋卡片：点击跳转设置页（家长创建）
- 选中后写入 localStorage，附加 `?child_id=xxx` 到 URL

### 4.2 导航栏孩子切换器

首页选中孩子后，导航栏左侧显示当前孩子下拉菜单：

- 点击下拉 → 列出所有孩子 → 点另一个立即切换
- 组件：`components/ui/child-switcher.tsx`

### 4.3 设置页 · 账号管理

在设置页底部新增"账号管理"区块：

- 列表展示所有孩子（头像、名字、年龄、语言）
- ✏️ 编辑弹窗（名字、头像、年龄段、语言）
- 🗑 删除确认弹窗（显示关联数据量，确认后永久删除）
- ＋ 创建弹窗
- 禁止删除最后一个孩子
- 组件：`components/ui/account-manager.tsx`

### 4.4 其他页面适配

| 页面 | 改动 |
|---|---|
| `/me` | 顶部显示当前孩子名称+头像；积分/段位/徽章按 child 作用域 |
| `/growth` | `child_profile` + `competency_snapshots` 按 child_id 过滤 |
| `/showcase` | 关联到当前孩子的项目作品 |
| `/report` | 家长报告仅展示当前活跃孩子 |
| `/parent` | 家长控制面板，当前孩子的使用限制配置 |

---

## 5. 边界情况与约束

### 5.1 边界情况

| 场景 | 处理 |
|---|---|
| 当前 child 被删除 | 自动跳转到 `/select`，选另一个 |
| localStorage 记录的 child_id 不再有效 | 忽略，展示选择页 |
| 同一设备两个标签页选不同孩子 | 切换后即时生效（localStorage + URL 参数） |
| 并发请求（SSE 流） | `child_id` 始终在 URL 中，按参数处理 |
| `/api/chat` SSE 连接中途切换孩子 | 旧连接保持（已带 child_id），新请求用新 child_id |

### 5.2 删除孩子

1. 展示确认弹窗，显示该孩子关联数据量
2. 确认后事务删除所有关联数据
3. 禁止删除最后一个孩子

### 5.3 全局约束

- 零新增 npm 依赖
- TypeScript strict，无 `any`
- 不改变 SSE 架构（只加 `child_id` 参数过滤）
- 不改变 P1-P8d 任何功能逻辑
- i18n 覆盖所有新增文案（3 语言 × N 新增 key）
- 存量数据自动迁移，不丢失

---

## 6. 不变内容

- 数据库 WAL 模式 + foreign_keys
- 模型路由与适配器
- 分龄配置与 Prompt 模板
- 引导引擎（5 层漏斗）
- 内容生成引擎
- 积分引擎、段位引擎、徽章逻辑（已有 user_id 参数）
- 语音互联情绪分析
- API 路由 return 结构
