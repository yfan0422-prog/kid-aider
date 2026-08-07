# Kid-Aider 分阶段开发计划

> 版本：v1.0
> 日期：2026-08-07
> 基于：[kid-aider_design.md](../../../kid-aider_design.md)

---

## 技术决策汇总

| 决策项 | 选择 |
|--------|------|
| 技术栈 | Next.js 14 App Router + React + TypeScript |
| 样式方案 | Tailwind CSS + shadcn/ui |
| 状态管理 | Zustand |
| 数据库 | better-sqlite3（本地文件存储） |
| LLM 协议 | OpenAI 兼容 + Anthropic 双协议 |
| 流式响应 | Server-Sent Events (SSE) |
| 引导引擎 | 混合模式：漏斗状态机硬编码 + 开放对话 Prompt 驱动 |
| 部署模式 | P1 纯 localhost → 后续逐步扩展局域网/云端 |
| 用户年龄段 | 三年龄段同时覆盖（6-9 / 10-12 / 13-15），通过配置切换 |
| 进度追踪 | 项目根目录 `DEVELOPMENT.md` 文件 |

---

## 总体阶段规划

```
P1 · MVP         P2 · 项目工坊       P3 · 成长可见       P4 · 智能进化       P5 · 语音互联       P6 · 全端完善
核心引导链路      + 复盘教练          + 能力成长          + 自我迭代          + 语音交互          + 云端部署
█░░░░░            ██░░░░             ███░░░             ████░░             █████░             ██████
~4 周             ~3 周              ~3 周              ~3 周              ~4 周              ~3 周
```

### 各阶段概要

| 阶段 | 主题 | 核心交付 | 可验证场景 |
|------|------|----------|-----------|
| **P1** | 核心引导链路 | 对话界面 + 五层需求漏斗 + 方案包生成 + 三年龄段切换 + 双 LLM 协议 | 孩子说"我想做个游戏"，30 分钟后拿到方案包 |
| **P2** | 项目工坊 | 项目地图 + 双轨拆解 + 打卡机制 + 断点续做 + 复盘四问 | 分 3 天完成一个项目，每天回来记得进度 |
| **P3** | 成长可见 | 六维能力画像 + 行为证据采集 + 徽章系统 + 作品墙 + 家长报告 | 家长看到孩子"需求澄清力"这月涨了 15 分 |
| **P4** | 智能进化 | 信号采集管线 + 引导质量评估 + 策略 A/B 实验 + 策略版本管理 + 模型配置 UI | 系统发现某策略让退出率降低，自动提升权重 |
| **P5** | 语音互联 | 儿童 ASR + 情绪感知 + 情感 TTS + 角色小K + 动态应对策略 | 6 岁孩子直接说话，系统听懂并感知情绪 |
| **P6** | 全端完善 | 设备互联同步 + 家长控制面板 + 云端部署 + 性能优化 + 国际化 | 孩子在平板上聊到一半，去 Mac 上继续 |

### 每阶段统一节奏

```
需求细化 → 技术设计 → 开发实现 → 自测验证 → 阶段回顾
```

---

## P1 · MVP 详细范围

### 目标

孩子打开 Kid-Aider → 说出想法 → 系统引导澄清 → 生成方案包 → 孩子带走使用。

### P1 范围清单（7 个模块）

| # | 模块 | 做什么 | 不做什么 |
|---|------|--------|----------|
| 1 | **项目脚手架** | Next.js + Tailwind + shadcn/ui 初始化；SQLite 数据层；基础布局（对话主列 + 右侧面板） | 不做用户登录/注册 |
| 2 | **对话界面** | 气泡组件（孩子/系统）、流式输出、输入框、三年龄段字号/间距切换 | 不做语音输入 |
| 3 | **引导引擎** | 混合模式——意图识别 + 需求漏斗五层状态机（硬编码）+ 通用对话 Prompt 驱动；分龄策略参数化 | 不做能力评估、不做脚手架渐撤 |
| 4 | **需求漏斗** | 五层逐步引导（愿望→对象→功能→约束→验收），每层产出实时渲染到需求树面板 | 不做需求树的可视化连线/动画 |
| 5 | **方案生成器** | 基于确认需求生成方案包 YAML/JSON，含 `agent_prompt`；孩子逐段确认界面；版本化（v1/v2） | 不自动调用下游智能体 |
| 6 | **模型配置** | 本地配置页——添加/编辑模型档案（协议、URL、Key、模型名、角色分配）；Key 存服务端；连通性测试 | 不做多用户配置、不做云端同步 |
| 7 | **知识库检索** | 系统提示词中注入设计文档核心概念（引导策略、分龄规则等），让 LLM 理解 Kid-Aider 的定位和边界 | 不做向量数据库，初期用静态 Prompt 模板 |

### P1 不做的
- 项目工坊、复盘教练、能力成长、自我迭代
- 语音交互
- 家长面板
- 设备同步
- 安全过滤层（MVP 阶段人工把关，不做自动过滤）

---

## P1 架构总览

### 分层结构

```
┌─────────────────────────────────────────────────────┐
│  前端 (Next.js App Router)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ 对话界面  │  │ 需求树面板 │  │ 方案包确认 / 设置  │   │
│  │ ChatView │  │FunnelPanel│  │Composer + Config │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │             │                │               │
│  ┌────┴─────────────┴────────────────┴──────────┐   │
│  │           状态管理 (Zustand)                    │   │
│  │   会话状态 · 漏斗进度 · 需求树 · 年龄配置       │   │
│  └──────────────────────┬───────────────────────┘   │
├─────────────────────────┼───────────────────────────┤
│  后端 (Next.js API Routes)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ /api/chat│  │/api/compose│ │/api/config/models│   │
│  │ 对话接口  │  │ 方案生成   │ │ 模型配置 CRUD     │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │             │                │               │
│  ┌────┴─────────────┴────────────────┴──────────┐   │
│  │            引导引擎 (Guide Engine)              │   │
│  │  意图识别 → 漏斗状态机 → 策略选择 → Prompt装配  │   │
│  └──────────────────────┬───────────────────────┘   │
│                          │                           │
│  ┌──────────────────────┴───────────────────────┐   │
│  │         模型路由 (Model Router)                │   │
│  │   OpenAI 兼容协议 · Anthropic 协议 · 降级切换   │   │
│  └──────────────────────┬───────────────────────┘   │
├─────────────────────────┼───────────────────────────┤
│  数据层                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ 会话记录  │  │ 方案包    │  │ 模型配置档案      │   │
│  │sessions  │  │ packs    │  │ model_profiles   │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│              SQLite (better-sqlite3)                  │
└─────────────────────────────────────────────────────┘
```

### 关键数据流

```
孩子输入 → Chat API → 引导引擎（意图判断 + 漏斗状态推进）
                         │
              ┌──────────┴──────────┐
              │  非漏斗对话          │  漏斗内对话
              │  Prompt 驱动         │  状态机驱动（当前层 + 缺失字段）
              │  自由引导            │  追问生成 → 更新需求树
              └──────────┬──────────┘
                         │
                    LLM 调用（模型路由选择协议和模型）
                         │
                    流式返回前端 → 气泡渲染
                         │
              漏斗五层全部完成 → /api/compose → 方案包生成
```

### 技术选型定稿

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | Next.js 14 App Router | RSC + API Routes 一体 |
| 样式 | Tailwind CSS + shadcn/ui | 设计 token 天然映射，组件可定制 |
| 状态管理 | Zustand | 轻量、无 boilerplate，适合中等复杂度 |
| 数据库 | better-sqlite3 | 同步 API、零配置、本地文件存储 |
| LLM 客户端 | openai SDK + @anthropic-ai/sdk | 分别处理两种协议 |
| 流式 | Server-Sent Events (SSE) | 原生支持，逐字返回 |

---

## P1 数据模型

### SQLite 表结构

```sql
-- 会话
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  title       TEXT DEFAULT '',
  age_group   TEXT NOT NULL DEFAULT '10-12',
  status      TEXT NOT NULL DEFAULT 'active',
  funnel_step INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 消息
CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  strategy_id TEXT,
  created_at  TEXT NOT NULL
);

-- 需求树节点
CREATE TABLE requirement_nodes (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  layer       INTEGER NOT NULL,
  label       TEXT NOT NULL,
  content     TEXT NOT NULL,
  parent_id   TEXT REFERENCES requirement_nodes(id),
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 方案包
CREATE TABLE solution_packs (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  version     INTEGER NOT NULL DEFAULT 1,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 模型配置档案
CREATE TABLE model_profiles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  base_url    TEXT NOT NULL,
  api_key     TEXT NOT NULL,
  model       TEXT NOT NULL,
  assigned_roles TEXT NOT NULL DEFAULT '["dialogue"]',
  params      TEXT NOT NULL DEFAULT '{"temperature":0.7,"max_tokens":2048}',
  is_default  INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

---

## P1 页面与组件树

### 页面路由

```
/                    → 主对话页
/settings             → 模型配置页
/api/chat             → 对话 API（POST，SSE 流式）
/api/compose          → 方案包生成 API（POST）
/api/config/models    → 模型配置 CRUD（GET/POST/PUT/DELETE）
```

### 前端组件树

```
app/
├── layout.tsx                    # 根布局：主题 Provider + 年龄上下文
├── page.tsx                      # 主对话页
│   ├── ChatView                  # 对话主列（左）
│   │   ├── MessageList           # 消息列表
│   │   │   ├── BubbleGuide       #   系统气泡
│   │   │   └── BubbleChild       #   孩子气泡
│   │   ├── StreamingBubble       # 流式输出中的气泡
│   │   └── InputBar              # 底部输入栏
│   │       ├── AgeSwitcher       #   年龄段切换
│   │       └── SendButton        #   发送按钮
│   └── SidePanel                 # 右侧面板
│       ├── FunnelView            #   需求树可视化
│       │   └── FunnelNode        #     单层节点
│       └── SolutionPreview       #   方案包预览
│
├── settings/
│   └── page.tsx                  # 模型配置页
│       ├── ModelProfileList
│       ├── ModelProfileForm
│       └── ConnectivityTest
│
└── api/
    ├── chat/route.ts
    ├── compose/route.ts
    └── config/models/route.ts
```

### 服务端模块

```
lib/
├── db/
│   ├── index.ts                  # SQLite 连接 & 初始化
│   ├── sessions.ts               # 会话 CRUD
│   ├── messages.ts               # 消息 CRUD
│   ├── requirements.ts           # 需求节点 CRUD
│   ├── solution-packs.ts         # 方案包 CRUD
│   └── model-profiles.ts         # 模型配置 CRUD
├── engine/
│   ├── intent.ts                 # 意图识别
│   ├── funnel-machine.ts         # 漏斗状态机
│   ├── strategy-picker.ts        # 策略选择器
│   └── prompt-builder.ts         # Prompt 装配
├── models/
│   ├── router.ts                 # 模型路由
│   ├── openai-adapter.ts         # OpenAI 协议适配
│   └── anthropic-adapter.ts      # Anthropic 协议适配
├── compose/
│   └── composer.ts              # 方案包生成
└── utils/
    ├── crypto.ts                 # API Key 加解密
    └── age-config.ts             # 分龄配置
```

---

## 进度追踪方案

项目根目录维护 `DEVELOPMENT.md`，格式：

```markdown
# Kid-Aider 开发进度

## 总体进度
P1 ████████░░ 80% | P2 ░░░░░░░░░░ 0% | P3-P6 未开始

## P1 · 核心引导链路（目标：2026-xx-xx）
- [x] 项目脚手架与基础布局
- [ ] 对话界面
- [ ] 引导引擎
- [ ] 需求漏斗
- [ ] 方案生成器
- [ ] 模型配置
- [ ] 知识库检索

## P2 · 项目工坊（未开始）
...
```

每个任务完成即打勾，阶段结束记录实际耗时与设计偏差。

---

## P2–P6 概要（后续细化）

### P2 · 项目工坊
- 项目 CRUD + 项目地图可视化
- 双轨道（软件/DIY）+ 里程碑管理
- 打卡机制 + 断点续做
- 复盘四问教练流程
- 外部执行登记

### P3 · 成长可见
- 六维度能力画像模型 + 雷达图
- 行为证据自动采集引擎
- 徽章系统（行为导向，非结果导向）
- 作品墙（可导出分享）
- 家长周报生成（一页纸）

### P4 · 智能进化
- 信号采集管线（效率/质量/体验/成长/主观）
- 引导质量离线评估
- 策略版本管理 + A/B 灰度
- 初衷校验自动检查清单
- 模型配置 UI 完善

### P5 · 语音互联
- 音频前端（VAD/降噪）
- 儿童适配 ASR
- 情绪感知引擎（双通道融合）
- 情感化 TTS + 角色小K
- 动态应对策略矩阵
- 语音安全与隐私

### P6 · 全端完善
- 设备配对 + 同步服务
- 家长控制面板
- 云端部署
- 安全过滤层
- 性能优化 + 国际化

---

*文档结束。下一步：执行 P1 实现计划。*
