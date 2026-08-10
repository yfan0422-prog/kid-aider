# Kid-Aider P4 · 家长控制 — 设计文档

> 版本：v1.0
> 日期：2026-08-09
> 基于：P3 成长可见 | Kid-Aider 产品设计 §12 安全与家长机制

---

## 1. 目标

P4 为家长提供控制面板，涵盖使用管理、项目管理和数据管控。家长角色是"观察者与协作者"（产品设计 §3.2），不介入孩子与系统的具体对话。

### 核心用户路径

```
家长侧：
  家长面板 /parent
  ├── 使用控制（时长/时段/内容过滤/解除限制）
  ├── 项目管理（详情/归档/删除/导出）
  ├── 数据面板（手动快照/全量导出）
  └── 系统日志（使用记录/AI 调用记录）
```

### 不在 P4 范围内

- 多孩子账号管理（P6）
- 云端同步（P6）
- 语音交互（P5）
- 设备互联/可移植性（产品设计 §11，推迟到后续阶段）

---

## 2. 访问控制

- `/parent` 直接访问，无密码保护
- 顶部导航栏不显示家长入口（孩子不可见），需手动输入 URL 或通过 `/settings` 底部小字链接进入

---

## 3. 数据模型（新增 2 张表）

```sql
-- 使用限制配置（单行表，id 恒为 1）
CREATE TABLE usage_config (
  id              INTEGER PRIMARY KEY CHECK(id = 1),
  daily_limit_min INTEGER,          -- 每天最多分钟数，NULL = 不限
  quiet_start     TEXT,             -- 免打扰开始 HH:mm，NULL = 不限
  quiet_end       TEXT,             -- 免打扰结束
  filter_enabled  INTEGER DEFAULT 0,-- 内容过滤开关 0/1
  restrictions_paused INTEGER DEFAULT 0, -- 限制暂停 0/1
  updated_at      TEXT NOT NULL
);

-- 每日使用记录
CREATE TABLE usage_log (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,        -- YYYY-MM-DD
  total_sec   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date)
);

-- 敏感词表
CREATE TABLE filtered_words (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  word  TEXT NOT NULL UNIQUE
);
```

### 项目表扩展

在现有 `projects` 表中新增 `archived` 状态：

```
status CHECK('active','paused','completed','archived')
```

---

## 4. 使用控制模块

### 4.1 时长限制

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 每日上限 | 滑块：30 / 60 / 90 / 120 / 不限 | 默认不限 |
| 80% 提醒 | "今天还剩 X 分钟哦" | toast，不阻断 |
| 100% 阻止 | "今天的探索时间到啦！明天再来吧 🌙" | 阻止新对话，不打断进行中的会话 |

活跃时间定义：有对话交互的时间（`POST /api/chat` 返回响应时记录增量秒数），非页面挂机。

### 4.2 免打扰时段

| 配置项 | 说明 |
|--------|------|
| 开始/结束时间 | HH:mm 格式，如 21:00 / 07:00 |
| 行为 | 时段内阻止新会话开始，提示"现在是休息时间，明天再来探索吧！" |
| 例外 | 已在进行中的会话不受影响 |

### 4.3 解除限制

- 家长面板顶部常驻开关：🔒 限制已开启 / 🔓 限制已暂停
- 暂停后所有时长和时段限制失效
- 恢复方式：下拉选择「1小时/今天/手动恢复」

### 4.4 内容过滤

- 家长可添加/删除敏感词
- AI 输出经 `String.includes()` 关键词匹配
- 命中 → 替换为安全提示，记录日志
- 默认预置 20 个中文不适龄词汇（写入 `filtered_words` 表的初始数据）

---

## 5. 项目管理模块

### 5.1 项目列表

- 所有项目卡片：标题、状态、创建时间、任务完成进度（done/total）
- 操作菜单：查看详情、归档/恢复、删除、导出
- 筛选：按状态（活跃/暂停/已完成/已归档）、按时间排序

### 5.2 项目详情

弹窗/展开视图：
- 完整对话记录（sessions → messages，含角色和内容）
- 项目结构（轨道 → 里程碑 → 任务列表 + 完成状态）
- P3 数据：该项目的快照记录和徽章获得

### 5.3 归档/恢复

- 归档：status → `archived`，从活跃项目列表隐藏
- 归档项目不参与 P3 评分和趋势
- 可恢复为 `paused`

### 5.4 项目导出

- 单个项目：JSON（结构 + 对话 + 打卡 + 复盘）
- 全量：所有项目 + 会话 + 能力数据 + 徽章 → 含 `manifest.json` 的 JSON 文件

### 5.5 年龄分组

- 下拉：6-9 / 10-12 / 13-15
- 修改后影响引导策略、任务难度、评语措辞
- 提示："不影响已有项目，仅对新会话生效"

---

## 6. 数据与日志模块

### 6.1 手动快照

- 调用 `POST /api/competency { action: "snapshot" }`
- 显示本周 6 维分数 + 新徽章（复用 P3 徽章评定）

### 6.2 全量数据导出

- 包含：sessions, messages, projects + 子表, competency_snapshots, badges, usage_log
- JSON 格式，含 `exported_at`、`version`、`tables` 字段
- 支持按日期范围筛选

### 6.3 系统日志

- 本周/本月使用时长、日均时间、活跃天数
- 最近 20 条操作记录
- 最近 5 次 AI 调用（时间、角色、耗时、成功/失败）

### 6.4 模型配置

- 从 `/settings` 迁移模型配置到 `/parent`
- `/settings` 保留基础设置（界面语言等，年龄分组移到家长面板）
- 功能不变：增删改模型档案、角色分配、连通性测试

---

## 7. API 设计

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/usage/config` | GET/PUT | 读取/更新使用限制配置 |
| `/api/usage/log` | GET | 获取每日使用记录 |
| `/api/usage/log` | POST | 记录活跃时间增量 `{ delta_sec }` |
| `/api/parent/filtered-words` | GET/POST/DELETE | 敏感词管理 |
| `/api/parent/check-filter` | POST | 检查文本是否命中过滤词 `{ text }` → `{ blocked, matched }` |
| `/api/parent/projects` | GET | 全部项目（含进度统计），支持 `?status=` / `?sort=` |
| `/api/parent/projects/[id]` | GET | 项目详情（含对话、结构、P3 数据） |
| `/api/parent/projects/[id]` | PATCH | 更新项目状态（归档/恢复） |
| `/api/parent/projects/[id]/export` | GET | 导出单个项目 JSON |
| `/api/parent/export` | GET | 全量数据导出，支持 `?from=&to=` |
| `/api/parent/logs` | GET | 操作日志 + AI 调用记录 |
| `/api/usage/check` | GET | 检查当前是否可访问（时长+时段综合判断） |

---

## 8. 组件树

```
app/parent/page.tsx
├── RestrictionsToggle         # 限制开关 🔒/🔓 + 恢复方式
├── TabBar                     # 控制 | 项目 | 数据 | 日志
├── UsageControl               # 时长滑块 + 免打扰时间选择器
├── ContentFilter              # 敏感词列表 + 添加/删除 + 开关
├── ProjectManager             # 项目卡片列表 + 筛选
│   └── ProjectDetailModal     # 对话+结构+快照
├── DataPanel                  # 手动快照按钮 + 全量导出
└── SystemLog                  # 使用摘要 + 操作记录 + AI 调用记录
```

---

## 9. 与现有系统的衔接

| 现有功能 | P4 影响 |
|----------|---------|
| `/settings` 模型配置 | 移入 `/parent`，`/settings` 仅保留基础设置 |
| `app/page.tsx` 导航 | 不添加家长入口链接 |
| `POST /api/chat` | 调用前检查使用限制，调用后记录活跃时间增量 |
| P3 `competency_snapshots` | 手动触发快照复用已有 API |
| P3 `badges` | 手动触发后展示新徽章 |
| `projects.status` | 新增 `archived` 枚举值，需更新类型定义 |

---

## 10. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 访问控制 | 无密码，URL 隐藏 | 单机环境，家长控制物理访问 |
| 敏感词过滤 | `String.includes()` | 单机轻量，无需 NLP 库 |
| 使用时间追踪 | 服务端按 API 调用记录增量 | 准确，不受页面挂机影响 |
| 归档实现 | 新增 status 枚举值 | 简单，不改 schema |
| 数据导出 | 纯 JSON | 零依赖，可读性好 |
| 模型配置迁移 | 从 /settings 移到 /parent | 集中管理，不再暴露给孩子 |
| 新增依赖 | 无 | 全部基于现有技术栈 |
