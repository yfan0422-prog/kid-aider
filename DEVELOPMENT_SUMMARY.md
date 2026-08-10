# Kid-Aider 开发总结

> 日期：2026-08-10
> 当前版本：v0.1（P1-P8a 全部完成）

---

## 一、项目概述

**Kid-Aider 是孩子与 AI 之间的"翻译官"和"教练"。** 它不替孩子干活，而是帮孩子把模糊的想法梳理成清晰的需求，把清晰的需求转化为可执行的方案包，孩子拿着方案去下游智能体中落 地实现。

### 核心定位

- **面向用户：** 6-15 岁儿童（分 6-9 / 10-12 / 13-15 三个年龄段）
- **交互范式：** 引导式对话（系统主动提问、澄清、补全），非问答式
- **产品边界：** 产出"方案包"而非成品代码，引导而非代劳
- **核心价值：** 每次交互都是一次思维训练——帮孩子学会"想清楚、说明白、拆步骤、做出来"

### 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript strict，零 `any` |
| 样式 | Tailwind CSS v3 + 自定义设计 token |
| 数据库 | better-sqlite3 (WAL 模式，同步 API) |
| 状态管理 | Zustand v5 |
| LLM 协议 | OpenAI 兼容 + Anthropic Messages 双协议 |
| 语音 | whisper.cpp (ASR) + Edge TTS / OpenAI TTS |

### 设计原则 (立项级，不可妥协)

| 原则 | 含义 |
|---|---|
| P1 全程引导式交互 | 对话不是一问一答，而是持续的梳理过程 |
| P2 问题解决与实践并重 | 轻量知识问答 + 多阶段项目实践，共享引导引擎 |
| P3 能力培养导向 | 六维度能力模型，每次交互显性锻炼思维与动手能力 |
| P4 系统可移植性 | 核心引导能力与服务端解耦，可嵌入外置设备 |
| P5 引导而非代劳 | 产出是孩子想清楚的方案，不动手替孩子做 |
| P6 自我提升 | 信号采集→质量评估→策略优化→灰度验证闭环 |
| P7 大模型可配置 | 多模型接入与角色化路由，不绑定单一供应商 |

---

## 二、系统架构

### 分层架构

```
┌──────────────────────────────────────────────────────────┐
│ 接入层     Mac App │ 外置设备端 │（未来）平板/网页端       │
├──────────────────────────────────────────────────────────┤
│ 交互层     对话界面 │ 需求树可视化 │ 项目地图 │ 成长档案   │
│            /me 仪表盘 │ /explore 探索页 │ /parent 控制台  │
├──────────────────────────────────────────────────────────┤
│ 引导层     引导引擎 │ 需求澄清漏斗 │ 方案生成器 │ 复盘教练  │
│            策略库（提问模板/分龄策略/脚手架规则）           │
├──────────────────────────────────────────────────────────┤
│ 能力层     能力评估模型 │ 成长档案 │ 反馈与徽章系统          │
│            积分引擎 │ 段位引擎 │ 习惯养成                  │
├──────────────────────────────────────────────────────────┤
│ 迭代层     信号采集 │ 画像计算 │ 兴趣/情绪趋势追踪          │
├──────────────────────────────────────────────────────────┤
│ 模型层     模型路由（多 LLM 适配）│ 提示词管理 │ 安全过滤    │
├──────────────────────────────────────────────────────────┤
│ 数据层     29 张表 │ SQLite WAL │ 本地优先 + 同步服务预留   │
└──────────────────────────────────────────────────────────┘
```

### 关键架构决策

1. **引导引擎与模型解耦** — 引导策略（问什么、怎么问）由策略库驱动，LLM 只负责"把策略表达成孩子能懂的话"
2. **方案包为标准交付物** — Kid-Aider 与下游智能体之间的接口协议
3. **能力画像独立建模** — 基于长期行为序列，存储本地优先（隐私）
4. **同步服务最小化** — 设备间只同步进度状态 + 档案数据
5. **零新增 npm 依赖** — 积分、排名、画像等全部自实现，不引入外部依赖

---

## 三、开发阶段总览

| 阶段 | 名称 | 交付内容 | 提交数 | 状态 |
|---|---|---|---|---|
| P1 | 核心引导链路 | 脚手架、数据库、引导引擎、Chat API、对话 UI | ~13 | ✅ |
| P2 | 项目工坊 | 项目管理、轨道/里程碑/任务分解、打卡、复盘 | ~13 | ✅ |
| P3 | 成长可见 | 能力评分、行为证据、徽章、雷达图、作品墙 | ~14 | ✅ |
| P4 | 家长控制 | 使用控制、敏感词过滤、家长面板、数据导出 | ~12 | ✅ |
| P5 | 语音互联 | ASR、TTS、情绪识别、语音 UI、情绪注入对话 | ~10 | ✅ |
| P6 | 智能进化 | 儿童画像、兴趣/情绪趋势、Chat 画像注入 | ~7 | ✅ |
| P7 | 内容生态 | 72 种子话题 × 3 语言、LLM 内容生成、探索页 | ~10 | ✅ |
| P8a | 习惯养成 | 积分系统、12 枚徽章、5 级段位、/me 仪表盘 | ~13 | ✅ |

**合计：** ~92 次功能提交，覆盖 8 个开发阶段。

---

## 四、数据模型（29 张表）

### P1 · 核心链路（5 张表）
| 表 | 说明 |
|---|---|
| `sessions` | 对话会话（年龄组、漏斗步骤、状态） |
| `messages` | 消息记录（child/guide/system 三角色） |
| `requirement_nodes` | 需求树节点（5 层漏斗，树形结构） |
| `solution_packs` | 方案包（版本化 YAML，状态流转） |
| `model_profiles` | 模型配置档案（OpenAI/Anthropic/Custom，角色路由） |

### P2 · 项目工坊（6 张表）
| 表 | 说明 |
|---|---|
| `projects` | 项目（关联 session，状态流转） |
| `tracks` | 双轨道（software / diy） |
| `milestones` | 里程碑（排序，完成时间） |
| `tasks` | 任务（what_to_do + how_hint + difficulty 1-3） |
| `check_ins` | 每日打卡（UNIQUE project_id + date） |
| `reflections` | 复盘（daily/milestone/final + 四问 q1-q4） |
| `project_logs` | 项目日志（操作审计 trail） |

### P3 · 成长可见（3 张表）
| 表 | 说明 |
|---|---|
| `competency_snapshots` | 能力评分快照（六维度 0-100，rule/ai 双 score_type） |
| `evidence_events` | 行为证据事件（dimension + event_type + source 归因） |
| `badges` | 成就徽章（silver/gold，competency/achievement 双 category） |

### P4 · 家长控制（3 张表）
| 表 | 说明 |
|---|---|
| `usage_config` | 使用配置（单例 id=1，时长/静默时段/过滤开关） |
| `usage_log` | 每日使用时长（date + total_sec，UPSERT） |
| `filtered_words` | 敏感词库（20 条种子 + 自定义添加） |

### P5 · 语音互联（2 张表）
| 表 | 说明 |
|---|---|
| `voice_sessions` | 语音会话（音频路径、转录文本、ASR 模型 + 耗时） |
| `emotion_log` | 情绪日志（voice/text/fused 三源，六情绪分类 + 置信度） |

### P6 · 智能进化（2 张表）
| 表 | 说明 |
|---|---|
| `child_profile` | 儿童画像（5 项能力 ×0-1、兴趣标签 JSON、情绪基线、会话统计） |
| `profile_updates` | 画像变更记录（session_start/end/deep_analysis 三触发类型） |

### P7 · 内容生态（3 张表）
| 表 | 说明 |
|---|---|
| `topic_catalog` | 话题目录（12 分类、3 年龄组、3 语言、source 溯源） |
| `topic_contents` | 话题内容（版本化，intro + challenges + project_prompt） |
| `topic_suggestions` | 智能推荐（兴趣标签 → 候选标题 + 可行性评分） |

### P8a · 习惯养成（4 张表）
| 表 | 说明 |
|---|---|
| `user_account` | 用户账号（单记录，display_name + avatar + 积分 + 连击） |
| `daily_activity` | 每日活动（6 action_type + 每日上限 + 防重） |
| `badge_def` | 徽章定义（12 枚种子，4 稀有度，5 解锁规则类型） |
| `badge_unlock` | 徽章解锁记录（UNIQUE user_id + badge_id） |

### 索引
共计 **22 个索引**，覆盖外键关联、日期范围查询、状态筛选和唯一性约束。

---

## 五、引擎层（15 个引擎）

| 引擎 | 文件 | 职责 |
|---|---|---|
| 引导引擎 | `funnel-machine.ts` | 驱动五层需求澄清漏斗，年龄适配 |
| 意图识别 | `intent.ts` | 区分提问/求助/项目想法/闲聊 |
| 方案生成 | `prompt-builder.ts` | 方案包 YAML 结构化生成 |
| 策略选择 | `strategy-picker.ts` | 分龄策略矩阵 + 脚手架渐撤 |
| 策略模板 | `strategy-templates.ts` | 5W1H/魔法棒/具象化/苏格拉底等提问模板 |
| 项目拆解 | `project-decomposer.ts` | 需求 → 轨道 → 里程碑 → 任务拆解 |
| 续接引擎 | `resume-builder.ts` | 跨天断点续做，3 句话帮孩子回忆 |
| 复盘教练 | `reflection-coach.ts` | 回顾/对比/提炼/迁移四问 |
| 能力评分 | `competency-scorer.ts` | 六维度规则评分 + AI 校准 |
| 徽章评定 | `badge-evaluator.ts` | 行为→成就徽章自动判定 |
| 证据采集 | `evidence-collector.ts` | 跨表行为事件采集与归因 |
| 画像计算 | `profile-builder.ts` | 五维能力 + 兴趣标签 + 情绪基线 + 趋势 |
| 内容生成 | `content-generator.ts` | 年龄 × 能力 × 格式 × 语言四维规则内容生成 |
| **积分引擎** | `points-engine.ts` | 6 action_type 每日上限 + 连击加成 + badge 自动解锁 |
| **段位引擎** | `rank-engine.ts` | 5 级段位 + 模拟排名语 + 距下一段位计算 |

---

## 六、页面路由（10 个页面）

| 路由 | 页面 | 所属阶段 |
|---|---|---|
| `/` | 主页（对话入口 + 导航） | P1 |
| `/projects` | 项目列表页 | P2 |
| `/projects/[id]` | 项目详情页（日历热力图 + 打卡 + 复盘） | P2 |
| `/growth` | 成长面板（雷达图 + 徽章墙） | P3 |
| `/showcase` | 作品墙 | P3 |
| `/report` | 家长报告页 | P3 |
| `/parent` | 家长控制台（Tab: 使用控制/敏感词/项目管理/数据面板/系统日志） | P4 |
| `/settings` | 模型配置 + 系统设置 | P4 |
| `/explore` | 儿童探索页（话题网格 + 详情 + 语言切换） | P7 |
| `/me` | 个人仪表盘（用户卡片 + 每日摘要 + 徽章收藏 + 段位卡片） | P8a |

---

## 七、API 路由（45 条路由）

### 核心引导（P1 · 6 条）
| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/chat` | POST | 对话（SSE 流式，意图识别 + 引导引擎 + 安全过滤） |
| `/api/compose` | POST | 方案包生成 |
| `/api/requirements` | GET/POST | 需求树 CRUD |
| `/api/config/models` | GET/PUT | 模型配置管理 |

### 项目工坊（P2 · 6 条）
| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/projects` | GET/POST | 项目列表 + 创建 |
| `/api/projects/[id]` | GET | 项目详情（含 tracks/milestones/tasks） |
| `/api/projects/[id]/tracks` | POST | 轨道创建（含拆解引擎） |
| `/api/projects/[id]/check-in` | POST | 每日打卡 (+P8a 积分) |
| `/api/projects/[id]/reflect` | POST | 复盘（四问提交）(+P8a 积分) |
| `/api/projects/[id]/resume` | POST | 续接上下文 |
| `/api/tasks/[id]/done` | POST | 任务完成标记 |

### 成长可见（P3 · 4 条）
| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/badges` | GET | 徽章列表（含获得时间） |
| `/api/competency` | GET | 能力评分数据 |
| `/api/report` | GET | 周报告数据 |
| `/api/showcase` | GET | 作品墙数据 |

### 家长控制（P4 · 8 条）
| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/usage/config` | GET/PUT | 使用配置（时长/静默/过滤） |
| `/api/usage/log` | POST | 使用时长记录 |
| `/api/usage/check` | GET | 使用权限检查 |
| `/api/parent/filtered-words` | GET/POST/DELETE | 敏感词管理 |
| `/api/parent/check-filter` | POST | 文本安全检查 |
| `/api/parent/projects` | GET | 所有项目列表 |
| `/api/parent/projects/[id]` | GET | 项目详情（含全部数据） |
| `/api/parent/projects/[id]/export` | GET | 单项目导出 |
| `/api/parent/export` | GET | 全量数据导出 |
| `/api/parent/logs` | GET | 系统日志 |

### 语音互联（P5 · 4 条）
| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/voice/asr` | POST | 语音转文字（whisper.cpp） |
| `/api/voice/tts` | POST | 文字转语音（Edge TTS / OpenAI TTS） |
| `/api/voice/emotion` | POST | 文本情绪分析 |
| `/api/voice/emotion-audio` | POST | 音频情绪分析（韵律特征 + 语义双通道） |

### 智能进化（P6 · 2 条）
| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/profile` | GET | 儿童画像（五维能力 + 兴趣 + 情绪基线） |
| `/api/profile/analyze` | POST | 深度分析（全量数据重算） |

### 内容生态（P7 · 8 条）
| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/topics` | GET/POST | 话题目录 CRUD |
| `/api/topics/[id]` | GET/PUT/DELETE | 话题详情 + 更新 |
| `/api/topics/[id]/contents` | GET | 话题内容（按年龄+语言匹配） |
| `/api/topics/[id]/generate` | POST | LLM 内容生成 (+P8a 积分) |
| `/api/topics/[id]/versions` | GET | 内容版本列表 |
| `/api/topics/[id]/versions/[versionId]` | GET | 版本详情 |
| `/api/topics/[id]/versions/[versionId]/activate` | POST | 版本激活 |
| `/api/topics/suggestions` | GET | 智能推荐列表 |
| `/api/topics/suggestions/[id]` | PUT | 推荐审核（通过/拒绝） |

### 习惯养成（P8a · 6 条）
| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/user/account` | GET/PUT | 账号获取（自动创建） + 更新 |
| `/api/user/activity` | GET/POST | 今日活动 + 积分记录（6 action_type 校验） |
| `/api/user/stats` | GET | 总积分 + 连击 + 段位 + 统计计数 |
| `/api/user/badges` | GET/POST | 徽章列表 + 手动检测 |
| `/api/leaderboard` | GET | 排行榜（本地模拟模式） |

---

## 八、前端组件（56 个组件文件）

### 通用组件层
| 组件 | 说明 |
|---|---|
| `layout/` | 全局布局（儿童导航 + 家长侧栏） |
| `chat/` | 对话 UI（BubbleGuide、BubbleChild、MessageList、ChatInput、FunnelPanel、ComposerPanel） |
| `ui/` | 通用 UI 组件 |

### 项目工坊组件
| 组件 | 说明 |
|---|---|
| `project/` | 项目列表卡、项目详情、轨道面板、里程碑卡片、任务列表 |
| `calendar/` | 日历热力图、打卡弹窗、复盘弹窗 |

### 成长面板组件
| 组件 | 说明 |
|---|---|
| `growth/` | 六维雷达图（SVG）、徽章墙、成长时间线 |

### 家长面板组件
| 组件 | 说明 |
|---|---|
| `parent/` | 使用控制面板、敏感词管理器、项目管理器、数据面板、系统日志视图 |

### 语音组件
| 组件 | 说明 |
|---|---|
| `voice/` | VoiceButton、AudioPlayer、EmotionIndicator |

### 探索页组件
| 组件 | 说明 |
|---|---|
| `parent/topic-detail.tsx` | 话题详情 + 挑战列表 + 完成按钮 (+P8a) |
| `parent/topic-manager.tsx` | 话题管理（目录 + 推荐审核双 Tab） |
| `explore/` | 话题网格、详情卡片、语言切换 |

### Me 仪表盘组件（P8a）
| 组件 | 说明 |
|---|---|
| `me/user-card.tsx` | 用户卡片（头像 + 可编辑名称 + 段位进度条 + 连击） |
| `me/daily-summary.tsx` | 每日摘要（6 action_type 图标 + 积分 + 连击标记） |
| `me/badge-collection.tsx` | 徽章网格（分类展示 + 稀有度配色 + 锁定叠加） |
| `me/rank-card.tsx` | 段位卡片（等级图标 + 排名语 + 下一段位进度） |

---

## 九、代码统计

| 指标 | 数值 |
|---|---|
| 源文件总数 | **169** (.ts / .tsx) |
| 总代码行数 | **~13,600** |
| API 路由 | **45** 条 |
| 页面路由 | **10** 个 |
| 组件文件 | **56** 个 |
| 数据库表 | **29** 张 |
| 数据库索引 | **22** 个 |
| 引擎模块 | **15** 个 |
| 数据库访问模块 | **25** 个 |
| 类型定义导出 | **56** 个 (type/interface) |
| Git 提交 | **~92** 次功能提交 |

---

## 十、P8a 习惯养成 — 最终审查结论

P8a 是整个系统第一个采用 **SDD (Subagent-Driven Development)** 执行的阶段。

| 指标 | 数值 |
|---|---|
| 任务数 | 11 |
| 修复轮次 | **0**（所有任务首次审查即通过） |
| 最终审查 | **APPROVED**（0 Critical, 2 Important → 1 fixed） |
| 新增文件 | 16 |
| 修改文件 | 8（6 集成 + 2 fix） |
| 代码增减 | +1,401 / -2 lines |

### 设计约束合规
- ✅ 零新增 npm 依赖
- ✅ TypeScript strict，零 `any`
- ✅ SSE 架构未变更
- ✅ 所有 45 条路由标注 `force-dynamic`
- ✅ 时间戳格式统一：`new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")`
- ✅ DB 访问统一通过 `getDb()`
- ✅ P7 内容层不受影响（side-effect 追加）

---

## 十一、开发方法论

### SDD (Subagent-Driven Development)

P8a 阶段首次实践的开发模式：

```
Plan → Task Brief → Fresh Implementer (haiku/sonnet) → Self-Review → Commit
                                                              ↓
                                              Task Reviewer (sonnet) → Spec ✅ + Quality ✅?
                                                              ↓ Yes
                                                        Next Task → ... → Final Broad Review (opus)
```

**效果：** 11 tasks × 0 fix loops = 前所未有的首次通过率。每次任务审查同时给出 spec 合规性 + 代码质量双维度判决，确保每步都在轨道上。

### 模型选择策略
- **haiku** — 机械转录任务（类型定义、DB 建表、CRUD 模块）
- **sonnet** — 集成与判断任务（引擎逻辑、API 路由、UI 组件）
- **opus** — 最终全分支审查

---

## 十二、待开发（P8b-P8d）

| 阶段 | 内容 | 优先级 |
|---|---|---|
| P8b | 内容-项目集成（探索→生成内容→进入项目工坊→完成任务打卡 全流程打通） | 2 |
| P8c | 国际化（i18n，三语言 UI 全局切换） | 3 |
| P8d | 部署（阿里云 + macOS / Apple 可安装包） | 4 |

---

## 十三、关键设计文档索引

| 文档 | 路径 |
|---|---|
| 系统设计总纲 | `kid-aider_design.md` (1080 行) |
| 开发进度 | `DEVELOPMENT.md` |
| P8a 设计规格 | `docs/superpowers/specs/2026-08-10-kid-aider-p8a-design.md` |
| P8a 实现计划 | `docs/superpowers/plans/2026-08-10-kid-aider-p8a-habit-formation.md` |
| P7 设计规格 | `docs/superpowers/specs/2026-08-09-kid-aider-p7-content-ecosystem.md` |
| P6 设计规格 | `docs/superpowers/specs/2026-08-09-kid-aider-p6-smart-evolution.md` |
| P5 设计规格 | `docs/superpowers/specs/2026-08-09-kid-aider-p5-voice.md` |
| P5 实现计划 | `docs/superpowers/plans/2026-08-09-kid-aider-p5-voice.md` |
| P4 设计规格 | `docs/superpowers/specs/2026-08-09-kid-aider-p4-design.md` |
| P4 实现计划 | `docs/superpowers/plans/2026-08-09-p4-parent-control.md` |
| P3 设计规格 + 实现计划 | `docs/superpowers/specs/2026-08-09-kid-aider-p3-design.md` |
| P2 实现计划 | `docs/superpowers/plans/2026-08-09-kid-aider-p2-project-studio.md` |
