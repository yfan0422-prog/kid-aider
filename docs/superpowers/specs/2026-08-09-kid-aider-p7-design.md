# Kid-Aider P7 · 内容生态 — 设计规格

> 日期：2026-08-09
> 状态：设计完成

## 目标

构建动态、可扩展的内容生态系统，让小K从"会引导"进化为"有内容可聊"。内容层支持三语（简中/繁中/英），利用 P6 画像引擎的兴趣数据，实现种子预设 + 智能推荐 + 手动添加三条内容供给路径。

---

## 1. 数据模型

### 1.1 topic_catalog

话题目录（轻量元数据，不存实际内容）：

```sql
CREATE TABLE IF NOT EXISTS topic_catalog (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,              -- 标题（孩子友好）
  summary       TEXT NOT NULL,              -- 一句话简介
  cover_image   TEXT,                       -- 配图 URL 或 emoji
  category      TEXT NOT NULL,              -- 分类名称
  age_group     TEXT NOT NULL,              -- "6-9" | "10-12" | "13-15" | "all"
  language      TEXT NOT NULL DEFAULT 'zh-CN', -- "zh-CN" | "zh-HK" | "en"
  interest_tag  TEXT,                       -- 关联 P6 兴趣标签，null=无关联
  source        TEXT NOT NULL DEFAULT 'seed', -- "seed" | "auto_suggested" | "manual"
  sort_order    INTEGER DEFAULT 0,
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 1.2 topic_contents

话题内容（按 topic + 年龄段 + 语言 + 版本 四维唯一）：

```sql
CREATE TABLE IF NOT EXISTS topic_contents (
  id              TEXT PRIMARY KEY,
  topic_id        TEXT NOT NULL REFERENCES topic_catalog(id),
  age_group       TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'zh-CN',
  version         INTEGER NOT NULL DEFAULT 1,
  intro_text      TEXT NOT NULL,            -- 百科简介 (markdown)
  challenges      TEXT NOT NULL,            -- JSON: [{title, description, hint, difficulty, materials, estimated_minutes}]
  project_prompt  TEXT,                     -- 项目入口引导词
  image_prompts   TEXT,                     -- JSON: [{section, prompt}]
  generation_rule_version TEXT NOT NULL,    -- 生成时用的规则版本号
  is_active       INTEGER NOT NULL DEFAULT 1,
  generated_at    TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_content_version
  ON topic_contents(topic_id, age_group, language, version);
```

**版本行为：**
- 首次生成 → `version=1, is_active=1`
- 刷新 → 新版本 `is_active=1`，旧版本 `is_active=0`
- 切换 → 选一个版本设 `is_active=1`，其余 `is_active=0`
- 手动删除 → 物理删除指定版本行
- 话题卡片展示始终读取 `is_active=1` 的版本

### 1.3 topic_suggestions

智能推荐记录（P6 兴趣触发 + 价值判断）：

```sql
CREATE TABLE IF NOT EXISTS topic_suggestions (
  id              TEXT PRIMARY KEY,
  interest_tag    TEXT NOT NULL,
  candidate_title TEXT NOT NULL,
  viability_score REAL NOT NULL,            -- 0.0-1.0
  viability_reason TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- "pending" | "approved" | "rejected"
  reviewed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**价值判断流程：**
1. P6 `interest_tags` 检测到新兴趣 → 触发 LLM 评估
2. 评估维度：可探索内容丰富度、年龄适配性、与已有话题重复度
3. `viability_score ≥ 0.6` → `status=pending`，家长面板可审核通过
4. `viability_score < 0.6` → `status=rejected`，仅作日志

---

## 2. 内容生成规则

三套规则叠加传入 LLM，确保输出质量一致。

### 2.1 年龄适配规则

| 维度 | 6-9 岁 | 10-12 岁 | 13-15 岁 |
|------|--------|----------|----------|
| 百科简介字数 | ≤80 字 | ≤150 字 | ≤300 字 |
| 句子长度 | ≤15 字/句 | ≤25 字/句 | 无限制 |
| 用词等级 | 生活用语，无术语 | 引入 1-2 个核心术语 | 可使用学科标准术语 |
| 互动挑战数 | 2 个 | 3 个 | 3-4 个 |
| 挑战难度基线 | 10-30 分钟可完成 | 30-60 分钟 | 可跨多次会话 |
| 语气风格 | 惊叹式："哇！""你知道吗？" | 邀请式："试试看""想一想" | 平等对话式 |

### 2.2 能力适配规则

叠加在年龄规则之上，基于 P6 `ChildProfile` 五项能力分 (0.0-1.0)：

| 能力信号 | 触发条件 | 规则调整 |
|---------|---------|---------|
| 创造力强 | `ability_creativity > 0.7` | 挑战中增加一个"自由发挥"项，不设标准答案 |
| 逻辑力弱 | `ability_logical < 0.3` | 每个挑战额外附带一条"小提示"，给出推理线索 |
| 专注力弱 | `ability_focus < 0.3` | 简介分段更短（每段≤3句），挑战间插入"中场休息"提示 |
| 表达力强 | `ability_expression > 0.7` | 挑战中加入"讲给别人听""画出来"等输出型任务 |
| 好奇心强 | `ability_curiosity > 0.7` | 简介末尾追加一个"延伸探索"问题 |
| 好奇心弱 | `ability_curiosity < 0.3` | 简介开头用更强的趣味钩子吸引注意 |

### 2.3 格式与结构规则

所有生成内容必须输出以下 JSON 结构：

```json
{
  "intro": "## {标题}\n\n...百科简介(markdown)...",
  "challenges": [
    {
      "title": "挑战名称（孩子友好）",
      "description": "怎么做（步骤化，按年龄控制步数）",
      "hint": "小提示（仅逻辑力<0.3或专注力<0.3时填充，否则null）",
      "difficulty": 1-3,
      "materials": ["需要的材料", "可替代材料"],
      "estimated_minutes": 15
    }
  ],
  "project_prompt": "对这个话题感兴趣？...（引导进入漏斗的种子文本）",
  "image_prompts": [
    {"section": "intro", "prompt": "简介配图生成提示词"},
    {"section": "challenge_0", "prompt": "挑战1配图生成提示词"}
  ]
}
```

### 2.4 语言规则

| 语言代码 | 输出要求 |
|---------|---------|
| `zh-CN` | 简体中文，中国大陆用语习惯 |
| `zh-HK` | 繁體中文，香港用語習慣（例如：的士→的士、冰箱→雪櫃） |
| `en` | English, age-appropriate vocabulary level |

### 2.5 呈分试对齐规则（仅"学业赋能"维度）

生成"中文精进""英文探索""数学思维""综合能力"分类下的内容时，额外注入：

```
你生成的内容应隐式对齐香港小学课程指引（不对孩子显示）：
- 中文：覆盖阅读理解策略、写作结构、词彙运用、标点规范
- 英文：Reading comprehension, grammar in context, creative expression, vocabulary building
- 数学：应用题拆解、速算策略、逻辑推理、图解表达
- 综合：时间管理、考试策略、错题分析方法、专注力训练

内容形式保持探索式学习风格——不刷题、不补习，以话题化 PBL 项目自然覆盖能力点。
```

规则版本号初始 `v1.0.0`，写入 `topic_contents.generation_rule_version`。

---

## 3. 分类体系与种子话题

### 3.1 分类结构（12 类，三个维度）

```
🔬 探索创造（兴趣驱动）
├── 自然科学
├── 技术编程
├── 视觉艺术
└── 音乐表演

📚 文化根基（价值塑造）
├── 历史长廊
├── 国学经典
├── 诗词歌赋
└── 中医智慧

🎯 学业赋能（呈分试导向）
├── 中文精进
├── 英文探索
├── 数学思维
└── 综合能力
```

### 3.2 种子话题（64 个，三种语言各存一份）

| 分类 | 6-9 岁 | 10-12 岁 | 13-15 岁 |
|------|--------|----------|----------|
| 🌿 自然科学 | 恐龙世界、神奇的动物、天气魔法 | 太阳系漫游、人体奥秘、海洋深处 | 量子世界入门、基因的秘密、气候变化 |
| 💻 技术编程 | 机器人朋友、指令游戏 | Scratch大冒险、APP怎么来的 | 网页是怎样建成的、AI是什么 |
| 🎨 视觉艺术 | 颜色魔法、泥巴大变身 | 漫画入门、摄影构图 | 设计思维、动画原理 |
| 🎵 音乐表演 | 声音的秘密、身体打击乐 | 认识乐器家族、节奏创作 | 音乐制作入门、歌曲结构分析 |
| 📜 历史长廊 | 如果生活在古代、四大发明 | 丝绸之路、古罗马兴衰 | 文明的碰撞、二十世纪改变世界的十件事 |
| 🏯 国学经典 | 成语里的故事、孔子的智慧 | 三十六计、古文小故事 | 老庄哲学入门、资治通鉴选读 |
| 📝 诗词歌赋 | 跟着唐诗去旅行、宋词里的四季 | 李白与杜甫、词牌里的故事 | 古典诗词鉴赏、现代诗创作 |
| 🌿 中医智慧 | 身体里的小卫士、神奇的中草药 | 经络与穴位、饮食与节气 | 中医基础理论、中西医对话 |
| 📖 中文精进 | 汉字的故事、有趣的部首、看图说故事 | 阅读理解大揭秘、作文小达人、成语活用术 | — |
| 🌏 英文探索 | My First Story、Fun with Phonics | Reading Detectives、Creative Writing、Speak & Shine | — |
| 🧮 数学思维 | 生活中的数学、图形魔法师 | 应用题解密、速算与估算、逻辑推理训练 | — |
| 🎯 综合能力 | 我的时间我做主、专注力训练营 | 考试不发慌（应试心态）、笔记术入门、错题本管理 | — |

> 注：学业赋能维度主要面向小学阶段，13-15 岁不设种子话题但预留分类槽位。

---

## 4. API 路由

### 新增

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/topics` | GET | 获取话题目录（支持 `?age=&category=&language=&source=`） |
| `/api/topics` | POST | 添加话题（手动或推荐批准后调用） |
| `/api/topics/[id]` | PUT | 更新话题元数据 |
| `/api/topics/[id]` | DELETE | 软删除话题 |
| `/api/topics/[id]/generate` | POST | 触发生成/刷新内容（LLM，返回新版本） |
| `/api/topics/[id]/contents` | GET | 获取当前激活版本内容 |
| `/api/topics/[id]/versions` | GET | 获取所有版本列表 |
| `/api/topics/[id]/versions/[versionId]/activate` | PUT | 切换激活版本 |
| `/api/topics/[id]/versions/[versionId]` | DELETE | 删除指定版本 |
| `/api/topics/suggestions` | GET | 获取智能推荐列表 |
| `/api/topics/suggestions/[id]` | PUT | 审核推荐（approve/reject） |

---

## 5. UI 扩展

### 5.1 孩子端：探索页 `app/explore/`

- **话题目录页**：分类 Tab + 话题卡片网格（标题、简介、封面 emoji）
- **话题详情页**：百科简介 + 互动挑战列表 + "进入项目工坊"入口
- 语言切换按钮（简中/繁中/EN）
- 复用现有设计 token 体系

### 5.2 家长端：话题管理 `app/parent/` + `components/parent/topic-manager.tsx`

- 新增 `"content"` Tab（在"画像"和"数据"之间）
- 话题增删改、生成状态查看
- 智能推荐审核（通过/拒绝）
- 版本历史管理（切换/删除）

### 5.3 首页入口

主页导航栏新增探索入口，对话中小K自然引导。

### 5.4 不修改

- 聊天界面（BubbleGuide / BubbleChild）
- SSE 架构
- P1-P6 所有现有组件

---

## 6. 边缘情况与错误处理

| 场景 | 处理 |
|------|------|
| 首次访问探索页，无任何话题 | 展示预设种子话题（默认语言），显示"生成中"占位 |
| LLM 生成超时或失败 | 话题保持"未生成"状态，UI 显示"暂时无法加载，请稍后再试" |
| 并发点击生成 | topic_contents 表唯一索引防重复；API 检查是否已有同版本生成中的标记 |
| 按年龄筛选无结果 | 展示"all"年龄的话题 + 提示"更多内容正在准备中" |
| 切换语言后话题不存在 | 自动触发生成该语言版本 |
| 删除最后版本 | 话题退回"未生成"状态，卡片显示"点击生成" |
| 软删除话题 | is_active=0，已有内容保留；探索页不展示但家长面板可恢复 |
| 种子数据升级 | 种子话题通过 source="seed" 标记；升级时按 id 匹配，新增的插入，已删除的软删除 |

---

## 7. 全局约束

- **零新增 npm 依赖** — 内容生成复用现有模型路由，结构化输出用 JSON mode
- **不改变现有 SSE 架构** — 话题 API 独立于聊天流
- **TypeScript strict，无 `any`**
- **内容生成异步不阻塞** — 同 P6 分析，fire-and-forget
- **遵循项目 token 设计系统** — 探索页和话题详情页复用现有 Tailwind 类
- **种子内容通过 DB 迁移脚本导入** — 不在 TS 源码中硬编码
- **P7 仅内容层支持三语** — 现有 UI 的国际化改造留作后续阶段（P8）
- **删除 topic 表后探索页优雅降级为空状态** — 不阻断其他功能
