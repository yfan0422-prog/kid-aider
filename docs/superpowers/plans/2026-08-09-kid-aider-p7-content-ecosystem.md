# P7 内容生态 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建动态内容生态系统——从种子话题目录出发，通过 LLM 按年龄/能力/格式/语言四套规则叠加生成结构化内容，支持版本管理与三语切换，让孩子端可探索、家长端可管理。

**Architecture:** 新增 3 张表（topic_catalog 轻量目录、topic_contents 版本化内容、topic_suggestions 智能推荐），内容生成引擎通过 `routeModel("dialogue")` 复用现有模型路由，输出结构化 JSON 并按 topic_id+age_group+language+version 四维唯一存储。孩子端新增独立探索页 `/explore`，家长端在现有面板新增 "content" Tab。种子数据通过迁移脚本导入，不硬编码在 TS 源码中。

**Tech Stack:** Next.js 14 + TypeScript strict + better-sqlite3 + Tailwind CSS v3（零新增依赖）

## Global Constraints

- **零新增 npm 依赖** — 内容生成复用现有模型路由，结构化输出用 JSON mode
- **不改变现有 SSE 架构** — 话题 API 独立于聊天流
- **TypeScript strict，无 `any`**
- **内容生成异步不阻塞** — 同 P6 分析，fire-and-forget
- **遵循项目 token 设计系统** — 探索页和话题详情页复用现有 Tailwind 类（`bg-surface`, `border-border`, `rounded-card`, `text-ink-tertiary`, `text-body-sm`, `text-body-lg`, `bg-surface-raised`, `bg-primary`, `rounded-btn`）
- **种子内容通过 DB 迁移脚本导入** — 不在 TS 源码中硬编码
- **P7 仅内容层支持三语** — 现有 UI 的国际化改造留作后续阶段（P8）
- **删除 topic 表后探索页优雅降级为空状态** — 不阻断其他功能

---

### Task 1: 类型定义与数据库建表

**Files:**
- Modify: `lib/utils/types.ts` — 追加 P7 类型
- Modify: `lib/db/index.ts` — 追加 3 张表 + 索引

**Interfaces:**
- Produces: `TopicCatalog`, `TopicContent`, `TopicSuggestion`, `TopicCategory`, `TopicSource`, `SuggestionStatus`, `TopicLanguage`, `ContentGenerationRequest`, `GeneratedContent`, `Challenge` 类型
- Produces: `topic_catalog`, `topic_contents`, `topic_suggestions` 表 + 索引

- [ ] **Step 1: 添加 TypeScript 类型**

在 `lib/utils/types.ts` 文件末尾追加：

```typescript
// ─── P7 内容生态 ───────────────────────────────────────────────

export type TopicLanguage = "zh-CN" | "zh-HK" | "en";
export type TopicCategory =
  | "自然科学" | "技术编程" | "视觉艺术" | "音乐表演"
  | "历史长廊" | "国学经典" | "诗词歌赋" | "中医智慧"
  | "中文精进" | "英文探索" | "数学思维" | "综合能力";
export type TopicSource = "seed" | "auto_suggested" | "manual";
export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface TopicCatalog {
  id: string;
  title: string;
  summary: string;
  cover_image: string | null;
  category: TopicCategory;
  age_group: AgeGroup | "all";
  language: TopicLanguage;
  interest_tag: string | null;
  source: TopicSource;
  sort_order: number;
  is_active: number; // 0|1
  created_at: string;
  updated_at: string;
}

export interface TopicContent {
  id: string;
  topic_id: string;
  age_group: string;
  language: TopicLanguage;
  version: number;
  intro_text: string;
  challenges: string; // JSON: Challenge[]
  project_prompt: string | null;
  image_prompts: string | null; // JSON: {section, prompt}[]
  generation_rule_version: string;
  is_active: number; // 0|1
  generated_at: string;
  created_at: string;
}

export interface Challenge {
  title: string;
  description: string;
  hint: string | null;
  difficulty: number; // 1-3
  materials: string[];
  estimated_minutes: number;
}

export interface ContentGenerationRequest {
  topicId: string;
  ageGroup: AgeGroup | "all";
  language: TopicLanguage;
  forceRefresh: boolean;
}

export interface GeneratedContent {
  intro: string;
  challenges: Challenge[];
  project_prompt: string;
  image_prompts: { section: string; prompt: string }[];
}

export interface TopicSuggestion {
  id: string;
  interest_tag: string;
  candidate_title: string;
  viability_score: number;
  viability_reason: string | null;
  status: SuggestionStatus;
  reviewed_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: 添加建表语句**

在 `lib/db/index.ts` 的 `db.exec()` 末尾（`return db;` 之前），`idx_usage_log_date` 索引之后追加：

```sql
CREATE TABLE IF NOT EXISTS topic_catalog (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  cover_image   TEXT,
  category      TEXT NOT NULL,
  age_group     TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'zh-CN',
  interest_tag  TEXT,
  source        TEXT NOT NULL DEFAULT 'seed',
  sort_order    INTEGER DEFAULT 0,
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topic_contents (
  id              TEXT PRIMARY KEY,
  topic_id        TEXT NOT NULL REFERENCES topic_catalog(id),
  age_group       TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'zh-CN',
  version         INTEGER NOT NULL DEFAULT 1,
  intro_text      TEXT NOT NULL,
  challenges      TEXT NOT NULL,
  project_prompt  TEXT,
  image_prompts   TEXT,
  generation_rule_version TEXT NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 1,
  generated_at    TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_content_version
  ON topic_contents(topic_id, age_group, language, version);

CREATE INDEX IF NOT EXISTS idx_topic_contents_active
  ON topic_contents(topic_id, is_active);

CREATE INDEX IF NOT EXISTS idx_topic_catalog_category
  ON topic_catalog(category);

CREATE INDEX IF NOT EXISTS idx_topic_catalog_age
  ON topic_catalog(age_group);

CREATE INDEX IF NOT EXISTS idx_topic_catalog_language
  ON topic_catalog(language);

CREATE INDEX IF NOT EXISTS idx_topic_catalog_source
  ON topic_catalog(source);

CREATE TABLE IF NOT EXISTS topic_suggestions (
  id              TEXT PRIMARY KEY,
  interest_tag    TEXT NOT NULL,
  candidate_title TEXT NOT NULL,
  viability_score REAL NOT NULL,
  viability_reason TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  reviewed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topic_suggestions_status
  ON topic_suggestions(status);
```

- [ ] **Step 3: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无新增类型错误。

- [ ] **Step 4: 验证表创建**

```bash
node -e "const {getDb}=require('./lib/db/index'); const db=getDb(); const tables=db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('topic_catalog','topic_contents','topic_suggestions')\").all(); console.log(tables);"
```

Expected: 3 张表均已创建。

- [ ] **Step 5: Commit**

```bash
git add lib/utils/types.ts lib/db/index.ts
git commit -m "feat(p7): add topic types and 3 new tables for content ecosystem"
```

---

### Task 2: 数据库访问层

**Files:**
- Create: `lib/db/topics.ts`

**Interfaces:**
- Consumes: `TopicCatalog`, `TopicContent`, `TopicSuggestion`, `Challenge`, `TopicLanguage`, `TopicCategory`, `AgeGroup`, `TopicSource`, `SuggestionStatus` from Task 1
- Consumes: `topic_catalog`, `topic_contents`, `topic_suggestions` 表 from Task 1
- Produces: `createTopic(attrs)` → `TopicCatalog`
- Produces: `getTopic(id: string)` → `TopicCatalog | undefined`
- Produces: `updateTopic(id: string, fields)` → `void`
- Produces: `softDeleteTopic(id: string)` → `void`
- Produces: `listTopics(filters?: { age?: string; category?: string; language?: string; source?: string; isActive?: boolean })` → `TopicCatalog[]`
- Produces: `getActiveContent(topicId: string, ageGroup: string, language: string)` → `TopicContent | undefined`
- Produces: `createTopicContent(attrs: { topic_id, age_group, language, version, intro_text, challenges: Challenge[], project_prompt?, image_prompts?, generation_rule_version })` → `TopicContent`
- Produces: `getContentVersions(topicId: string, ageGroup: string, language: string)` → `TopicContent[]`
- Produces: `activateVersion(versionId: string)` → `void`
- Produces: `deleteVersion(versionId: string)` → `void`
- Produces: `getLatestVersionNumber(topicId: string, ageGroup: string, language: string)` → `number`
- Produces: `createSuggestion(attrs: { interest_tag, candidate_title, viability_score, viability_reason? })` → `TopicSuggestion`
- Produces: `getPendingSuggestions()` → `TopicSuggestion[]`
- Produces: `reviewSuggestion(id: string, status: "approved" | "rejected")` → `void`

- [ ] **Step 1: 创建 `lib/db/topics.ts`**

```typescript
import { getDb } from "./index";
import { v4 as uuid } from "uuid";
import type {
  TopicCatalog,
  TopicContent,
  TopicSuggestion,
  TopicLanguage,
  TopicCategory,
  AgeGroup,
  Challenge,
} from "@/lib/utils/types";

// ─── topic_catalog ──────────────────────────────────────────────

export function createTopic(attrs: {
  title: string;
  summary: string;
  cover_image?: string;
  category: string;
  age_group: string;
  language: string;
  interest_tag?: string;
  source?: string;
  sort_order?: number;
}): TopicCatalog {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(`
    INSERT INTO topic_catalog (id, title, summary, cover_image, category, age_group, language, interest_tag, source, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    attrs.title,
    attrs.summary,
    attrs.cover_image ?? null,
    attrs.category,
    attrs.age_group,
    attrs.language,
    attrs.interest_tag ?? null,
    attrs.source ?? "manual",
    attrs.sort_order ?? 0,
    now,
    now,
  );
  return getTopic(id)!;
}

export function getTopic(id: string): TopicCatalog | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM topic_catalog WHERE id = ?").get(id) as TopicCatalog | undefined;
}

export function updateTopic(
  id: string,
  fields: Partial<Pick<TopicCatalog, "title" | "summary" | "cover_image" | "category" | "age_group" | "interest_tag" | "sort_order" | "is_active">>
): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(", ");
  const values = keys.map(k => (fields as Record<string, unknown>)[k]);
  db.prepare(`UPDATE topic_catalog SET ${setClause}, updated_at = ? WHERE id = ?`)
    .run(...values, now, id);
}

export function softDeleteTopic(id: string): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare("UPDATE topic_catalog SET is_active = 0, updated_at = ? WHERE id = ?").run(now, id);
}

export function listTopics(filters?: {
  age?: string;
  category?: string;
  language?: string;
  source?: string;
  isActive?: boolean;
}): TopicCatalog[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters) {
    if (filters.age) {
      conditions.push("(age_group = ? OR age_group = 'all')");
      params.push(filters.age);
    }
    if (filters.category) {
      conditions.push("category = ?");
      params.push(filters.category);
    }
    if (filters.language) {
      conditions.push("language = ?");
      params.push(filters.language);
    }
    if (filters.source) {
      conditions.push("source = ?");
      params.push(filters.source);
    }
    if (filters.isActive !== undefined) {
      conditions.push("is_active = ?");
      params.push(filters.isActive ? 1 : 0);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM topic_catalog ${where} ORDER BY sort_order ASC, created_at DESC`).all(...params) as TopicCatalog[];
}

// ─── topic_contents ─────────────────────────────────────────────

export function getActiveContent(
  topicId: string,
  ageGroup: string,
  language: string
): TopicContent | undefined {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM topic_contents WHERE topic_id = ? AND age_group = ? AND language = ? AND is_active = 1"
  ).get(topicId, ageGroup, language) as TopicContent | undefined;
}

export function createTopicContent(attrs: {
  topic_id: string;
  age_group: string;
  language: string;
  version: number;
  intro_text: string;
  challenges: Challenge[];
  project_prompt?: string;
  image_prompts?: { section: string; prompt: string }[];
  generation_rule_version: string;
}): TopicContent {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();

  // Deactivate all existing versions for this topic+age+language combo
  db.prepare(
    "UPDATE topic_contents SET is_active = 0 WHERE topic_id = ? AND age_group = ? AND language = ?"
  ).run(attrs.topic_id, attrs.age_group, attrs.language);

  db.prepare(`
    INSERT INTO topic_contents (id, topic_id, age_group, language, version, intro_text, challenges, project_prompt, image_prompts, generation_rule_version, is_active, generated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    attrs.topic_id,
    attrs.age_group,
    attrs.language,
    attrs.version,
    attrs.intro_text,
    JSON.stringify(attrs.challenges),
    attrs.project_prompt ?? null,
    attrs.image_prompts ? JSON.stringify(attrs.image_prompts) : null,
    attrs.generation_rule_version,
    now,
    now,
  );

  return db.prepare("SELECT * FROM topic_contents WHERE id = ?").get(id) as TopicContent;
}

export function getContentVersions(
  topicId: string,
  ageGroup: string,
  language: string
): TopicContent[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM topic_contents WHERE topic_id = ? AND age_group = ? AND language = ? ORDER BY version DESC"
  ).all(topicId, ageGroup, language) as TopicContent[];
}

export function activateVersion(versionId: string): void {
  const db = getDb();
  const content = db.prepare("SELECT * FROM topic_contents WHERE id = ?").get(versionId) as TopicContent | undefined;
  if (!content) return;

  // Deactivate all for this topic+age+language
  db.prepare(
    "UPDATE topic_contents SET is_active = 0 WHERE topic_id = ? AND age_group = ? AND language = ?"
  ).run(content.topic_id, content.age_group, content.language);

  // Activate the chosen version
  db.prepare("UPDATE topic_contents SET is_active = 1 WHERE id = ?").run(versionId);
}

export function deleteVersion(versionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM topic_contents WHERE id = ?").run(versionId);
}

export function getLatestVersionNumber(
  topicId: string,
  ageGroup: string,
  language: string
): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT MAX(version) as max_ver FROM topic_contents WHERE topic_id = ? AND age_group = ? AND language = ?"
  ).get(topicId, ageGroup, language) as { max_ver: number | null };
  return row?.max_ver ?? 0;
}

// ─── topic_suggestions ──────────────────────────────────────────

export function createSuggestion(attrs: {
  interest_tag: string;
  candidate_title: string;
  viability_score: number;
  viability_reason?: string;
}): TopicSuggestion {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(`
    INSERT INTO topic_suggestions (id, interest_tag, candidate_title, viability_score, viability_reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, attrs.interest_tag, attrs.candidate_title, attrs.viability_score, attrs.viability_reason ?? null, now);
  return {
    id,
    interest_tag: attrs.interest_tag,
    candidate_title: attrs.candidate_title,
    viability_score: attrs.viability_score,
    viability_reason: attrs.viability_reason ?? null,
    status: "pending",
    reviewed_at: null,
    created_at: now,
  };
}

export function getPendingSuggestions(): TopicSuggestion[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM topic_suggestions WHERE status = 'pending' ORDER BY viability_score DESC, created_at DESC"
  ).all() as TopicSuggestion[];
}

export function reviewSuggestion(id: string, status: "approved" | "rejected"): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare("UPDATE topic_suggestions SET status = ?, reviewed_at = ? WHERE id = ?")
    .run(status, now, id);
}
```

- [ ] **Step 2: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add lib/db/topics.ts
git commit -m "feat(p7): add topic DB access layer with CRUD for catalog, contents, and suggestions"
```

---

### Task 3: 内容生成引擎

**Files:**
- Create: `lib/engine/content-generator.ts`

**Interfaces:**
- Consumes: `routeModel` from `lib/models/router`, `TopicCatalog`, `ChildProfile`, `TopicLanguage`, `AgeGroup`, `Challenge`, `GeneratedContent` from Task 1
- Consumes: `createTopicContent`, `getLatestVersionNumber`, `getActiveContent` from Task 2
- Produces: `generateContent(topic: TopicCatalog, language: TopicLanguage, profile?: ChildProfile | null) → Promise<TopicContent>`
- Produces: `buildGenerationPrompt(opts) → string` (内部辅助函数，导出用于测试)

- [ ] **Step 1: 创建 `lib/engine/content-generator.ts`**

```typescript
import { routeModel } from "@/lib/models/router";
import { createTopicContent, getLatestVersionNumber, getActiveContent } from "@/lib/db/topics";
import { getOrCreateChildProfile } from "@/lib/db/child-profile";
import type { TopicCatalog, TopicContent, Challenge, GeneratedContent, TopicLanguage, ChildProfile } from "@/lib/utils/types";

const RULE_VERSION = "v1.0.0";

// ─── 年龄规则 ───────────────────────────────────────────────────

interface AgeRules {
  introMaxChars: number;
  maxCharsPerSentence: number;
  terminologyLevel: string;
  challengeCount: number;
  difficultyBaseline: number;
  toneStyle: string;
}

function getAgeRules(ageGroup: string): AgeRules {
  switch (ageGroup) {
    case "6-9":
      return {
        introMaxChars: 80,
        maxCharsPerSentence: 15,
        terminologyLevel: "avoid_all_terminology",
        challengeCount: 2,
        difficultyBaseline: 1,
        toneStyle: "wonder",
      };
    case "10-12":
      return {
        introMaxChars: 150,
        maxCharsPerSentence: 25,
        terminologyLevel: "introduce_1_2_terms",
        challengeCount: 3,
        difficultyBaseline: 2,
        toneStyle: "inviting",
      };
    case "13-15":
      return {
        introMaxChars: 300,
        maxCharsPerSentence: Infinity,
        terminologyLevel: "standard_terminology",
        challengeCount: 3,
        difficultyBaseline: 3,
        toneStyle: "equal_dialogue",
      };
    default:
      return getAgeRules("10-12");
  }
}

function getToneInstruction(style: string): string {
  switch (style) {
    case "wonder":
      return "使用惊叹式语气，多用"哇！""你知道吗？"等惊奇表达。句子简短活泼。";
    case "inviting":
      return "使用邀请式语气，多用"试试看""想一想"等引导表达。鼓励孩子主动探索。";
    case "equal_dialogue":
      return "使用平等对话语气，像与朋友交流一样自然。可直接讨论抽象概念。";
    default:
      return "";
  }
}

// ─── 能力规则 ───────────────────────────────────────────────────

interface AbilityAdjustments {
  addFreeformChallenge: boolean;
  addHintToAllChallenges: boolean;
  shortParagraphs: boolean;
  midSessionBreak: boolean;
  addOutputTask: boolean;
  addExtensionQuestion: boolean;
  useStrongerHook: boolean;
}

function getAbilityAdjustments(profile: ChildProfile | null): AbilityAdjustments {
  if (!profile) {
    return {
      addFreeformChallenge: false,
      addHintToAllChallenges: false,
      shortParagraphs: false,
      midSessionBreak: false,
      addOutputTask: false,
      addExtensionQuestion: false,
      useStrongerHook: false,
    };
  }

  return {
    addFreeformChallenge: profile.ability_creativity > 0.7,
    addHintToAllChallenges: profile.ability_logical < 0.3 || profile.ability_focus < 0.3,
    shortParagraphs: profile.ability_focus < 0.3,
    midSessionBreak: profile.ability_focus < 0.3,
    addOutputTask: profile.ability_expression > 0.7,
    addExtensionQuestion: profile.ability_curiosity > 0.7,
    useStrongerHook: profile.ability_curiosity < 0.3,
  };
}

function buildAbilityInstructions(adj: AbilityAdjustments): string {
  const instructions: string[] = [];
  if (adj.addFreeformChallenge) {
    instructions.push("- 在挑战末尾增加一个"自由发挥"项：标题为"你的创意时间"，不设标准答案，鼓励孩子按自己的方式探索。");
  }
  if (adj.addHintToAllChallenges) {
    instructions.push("- 每个挑战额外附带一条"小提示"，给出推理线索或操作建议，降低挫败感。");
  }
  if (adj.shortParagraphs) {
    instructions.push("- 简介每段不超过 3 句话，保持段落短小，便于保持注意力。");
  }
  if (adj.midSessionBreak) {
    instructions.push("- 在第 2 个挑战后面插入一个"中场休息"提示：给出一个简单的伸展或深呼吸建议。");
  }
  if (adj.addOutputTask) {
    instructions.push("- 挑战中加入一个输出型任务：要求孩子把学到的内容"讲给别人听"或"画出来"。");
  }
  if (adj.addExtensionQuestion) {
    instructions.push("- 简介末尾追加一个"延伸探索"问题，激发孩子进一步思考。");
  }
  if (adj.useStrongerHook) {
    instructions.push("- 简介开头用一个更强的趣味钩子（有趣的事实、惊人的问题等）来吸引注意力。");
  }
  return instructions.join("\n");
}

// ─── 呈分试规则 ──────────────────────────────────────────────────

const SFA_ALIGNMENT_INSTRUCTION = `
你生成的内容应隐式对齐香港小学课程指引（不对孩子显示）：
- 中文：覆盖阅读理解策略、写作结构、词彙运用、标点规范
- 英文：Reading comprehension, grammar in context, creative expression, vocabulary building
- 数学：应用题拆解、速算策略、逻辑推理、图解表达
- 综合：时间管理、考试策略、错题分析方法、专注力训练

内容形式保持探索式学习风格——不刷题、不补习，以话题化 PBL 项目自然覆盖能力点。`;

const SFA_CATEGORIES = ["中文精进", "英文探索", "数学思维", "综合能力"];

// ─── 语言规则 ───────────────────────────────────────────────────

function getLanguageInstruction(language: TopicLanguage): string {
  switch (language) {
    case "zh-CN":
      return "使用简体中文输出。使用中国大陆用语习惯。";
    case "zh-HK":
      return "使用繁體中文輸出。使用香港用語習慣（例如：的士而非出租車、雪櫃而非冰箱、電腦而非計算機、質素而非質量）。";
    case "en":
      return "Output in English. Use age-appropriate vocabulary. For younger children, use simple words and short sentences. For older children, introduce richer vocabulary.";
    default:
      return "使用简体中文输出。";
  }
}

// ─── Prompt 构建 ─────────────────────────────────────────────────

export function buildGenerationPrompt(opts: {
  topic: TopicCatalog;
  language: TopicLanguage;
  profile: ChildProfile | null;
}): string {
  const ageRules = getAgeRules(opts.topic.age_group === "all" ? "10-12" : opts.topic.age_group);
  const adj = getAbilityAdjustments(opts.profile);
  const langInst = getLanguageInstruction(opts.language);
  const isSFA = SFA_CATEGORIES.includes(opts.topic.category);

  const sections: string[] = [
    `你是一个儿童教育内容生成专家。请为以下话题生成结构化学习内容。`,
    ``,
    `## 话题信息`,
    `- 标题：${opts.topic.title}`,
    `- 简介方向：${opts.topic.summary}`,
    `- 分类：${opts.topic.category}`,
    `- 目标年龄段：${opts.topic.age_group === "all" ? "全年龄" : `${opts.topic.age_group} 岁`}`,
    ``,
    `## 格式要求`,
    `请输出以下 JSON 结构（不要输出任何 JSON 之外的文本）：`,
    `{`,
    `  "intro": "## {标题}\\n\\n...百科简介(markdown)...",`,
    `  "challenges": [`,
    `    {`,
    `      "title": "挑战名称（孩子友好）",`,
    `      "description": "怎么做（步骤化，按年龄控制步数）",`,
    `      "hint": "小提示" | null,`,
    `      "difficulty": 1-3,`,
    `      "materials": ["需要的材料", "可替代材料"],`,
    `      "estimated_minutes": 15`,
    `    }`,
    `  ],`,
    `  "project_prompt": "对这个话题感兴趣？...（引导进入项目工坊的种子文本）",`,
    `  "image_prompts": [`,
    `    {"section": "intro", "prompt": "简介配图的英文 AI 绘画提示词"},`,
    `    {"section": "challenge_0", "prompt": "挑战1配图的英文 AI 绘画提示词"}`,
    `  ]`,
    `}`,
    ``,
    `## 年龄适配规则`,
    `- 百科简介字数：≤${ageRules.introMaxChars} 字`,
    `- 句子长度：≤${ageRules.maxCharsPerSentence === Infinity ? "无限制" : `${ageRules.maxCharsPerSentence} 字/句`}`,
    `- 用词等级：${ageRules.terminologyLevel === "avoid_all_terminology" ? "纯生活用语，不使用任何专业术语" : ageRules.terminologyLevel === "introduce_1_2_terms" ? "可引入 1-2 个核心术语，但要用简单语言解释" : "可使用学科标准术语"}`,
    `- 互动挑战数：${ageRules.challengeCount} 个`,
    `- 挑战难度基线：${ageRules.difficultyBaseline} 级（1-3）`,
    `- 语气风格：${getToneInstruction(ageRules.toneStyle)}`,
    ``,
    `${adj.addFreeformChallenge || adj.addHintToAllChallenges || adj.shortParagraphs || adj.addOutputTask || adj.addExtensionQuestion || adj.useStrongerHook ? `## 能力适配规则\n${buildAbilityInstructions(adj)}\n` : ""}`,
    `${isSFA ? `## 呈分试对齐规则\n${SFA_ALIGNMENT_INSTRUCTION}\n` : ""}`,
    `## 语言规则`,
    langInst,
    ``,
    `请直接输出 JSON，不要使用 markdown 代码块包裹。`,
  ];

  return sections.join("\n");
}

// ─── 生成入口 ───────────────────────────────────────────────────

export async function generateContent(
  topic: TopicCatalog,
  language: TopicLanguage,
  profile?: ChildProfile | null
): Promise<TopicContent | null> {
  const routed = routeModel("dialogue");
  if (!routed) {
    console.error("[content-generator] no model available for dialogue role");
    return null;
  }

  const p = profile ?? null;
  const prompt = buildGenerationPrompt({ topic, language, profile: p });
  const ageGroup = topic.age_group;
  const newVersion = getLatestVersionNumber(topic.id, ageGroup, language) + 1;

  try {
    const result = await routed.adapter.chat({ system: prompt, messages: [] });
    // Parse the LLM response as JSON
    const text = result.content || "";
    // Strip potential markdown code fences
    const jsonText = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    let parsed: GeneratedContent;
    try {
      parsed = JSON.parse(jsonText) as GeneratedContent;
    } catch {
      console.error("[content-generator] failed to parse LLM response as JSON:", jsonText.slice(0, 200));
      return null;
    }

    // Validate required fields
    if (!parsed.intro || !Array.isArray(parsed.challenges) || parsed.challenges.length === 0) {
      console.error("[content-generator] invalid generated content structure");
      return null;
    }

    const content = createTopicContent({
      topic_id: topic.id,
      age_group: ageGroup,
      language,
      version: newVersion,
      intro_text: parsed.intro,
      challenges: parsed.challenges,
      project_prompt: parsed.project_prompt || undefined,
      image_prompts: parsed.image_prompts || undefined,
      generation_rule_version: RULE_VERSION,
    });

    return content;
  } catch (err) {
    console.error("[content-generator] generation failed:", err);
    return null;
  }
}
```

- [ ] **Step 2: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add lib/engine/content-generator.ts
git commit -m "feat(p7): add content generation engine with age+ability+format+language rules"
```

---

### Task 4: 核心 API 路由 — 目录与内容

**Files:**
- Create: `app/api/topics/route.ts`
- Create: `app/api/topics/[id]/route.ts`
- Create: `app/api/topics/[id]/contents/route.ts`

**Interfaces:**
- Consumes: `listTopics`, `createTopic`, `getTopic`, `updateTopic`, `softDeleteTopic` from Task 2
- Consumes: `getActiveContent` from Task 2
- Produces: `GET /api/topics`, `POST /api/topics`, `PUT /api/topics/[id]`, `DELETE /api/topics/[id]`, `GET /api/topics/[id]/contents`

- [ ] **Step 1: 创建 `app/api/topics/route.ts`**

```typescript
import { listTopics, createTopic } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const age = searchParams.get("age") || undefined;
  const category = searchParams.get("category") || undefined;
  const language = searchParams.get("language") || undefined;
  const source = searchParams.get("source") || undefined;

  const topics = listTopics({
    age,
    category,
    language,
    source,
    isActive: true,
  });

  return Response.json({ topics });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, summary, cover_image, category, age_group, language, interest_tag } = body;

  if (!title || !summary || !category || !age_group) {
    return Response.json({ error: "title, summary, category, age_group are required" }, { status: 400 });
  }

  const topic = createTopic({
    title,
    summary,
    cover_image: cover_image || undefined,
    category,
    age_group,
    language: language || "zh-CN",
    interest_tag: interest_tag || undefined,
    source: "manual",
  });

  return Response.json({ topic }, { status: 201 });
}
```

- [ ] **Step 2: 创建 `app/api/topics/[id]/route.ts`**

```typescript
import { getTopic, updateTopic, softDeleteTopic } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const body = await req.json();
  updateTopic(params.id, body);
  const updated = getTopic(params.id);

  return Response.json({ topic: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  softDeleteTopic(params.id);
  return Response.json({ status: "deleted" });
}
```

- [ ] **Step 3: 创建 `app/api/topics/[id]/contents/route.ts`**

```typescript
import { getTopic } from "@/lib/db/topics";
import { getActiveContent } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const ageGroup = searchParams.get("age_group") || topic.age_group;
  const language = searchParams.get("language") || topic.language;

  const content = getActiveContent(params.id, ageGroup, language);

  return Response.json({
    topic,
    content: content || null,
    hasContent: content !== undefined,
  });
}
```

- [ ] **Step 4: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add app/api/topics/
git commit -m "feat(p7): add core API routes for topic catalog and content retrieval"
```

---

### Task 5: API 路由 — 内容生成与版本管理

**Files:**
- Create: `app/api/topics/[id]/generate/route.ts`
- Create: `app/api/topics/[id]/versions/route.ts`
- Create: `app/api/topics/[id]/versions/[versionId]/route.ts`
- Create: `app/api/topics/[id]/versions/[versionId]/activate/route.ts`

**Interfaces:**
- Consumes: `getTopic`, `getContentVersions`, `activateVersion`, `deleteVersion`, `getLatestVersionNumber` from Task 2
- Consumes: `generateContent` from Task 3

- [ ] **Step 1: 创建 `app/api/topics/[id]/generate/route.ts`**

```typescript
import { getTopic, getActiveContent } from "@/lib/db/topics";
import { generateContent } from "@/lib/engine/content-generator";
import { getOrCreateChildProfile } from "@/lib/db/child-profile";
import type { TopicLanguage } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const { language, force_refresh } = await req.json().catch(() => ({}));
  const lang: TopicLanguage = language || topic.language;
  const forceRefresh = force_refresh === true;

  // If not force-refreshing and content already exists, return existing
  if (!forceRefresh) {
    const existing = getActiveContent(params.id, topic.age_group, lang);
    if (existing) {
      return Response.json({ content: existing, generated: false, reason: "content_exists" });
    }
  }

  // Fire-and-forget: start generation, return immediately with pending status
  const profile = getOrCreateChildProfile();

  // Start generation asynchronously
  const generationPromise = generateContent(topic, lang, profile);

  // Return a "generating" response immediately
  // The client polls GET /api/topics/[id]/contents to check for results
  generationPromise.then((content) => {
    if (content) {
      console.log(`[generate] content generated for topic ${params.id} v${content.version}`);
    } else {
      console.error(`[generate] content generation failed for topic ${params.id}`);
    }
  });

  return Response.json({
    status: "generating",
    topic_id: params.id,
    language: lang,
  });
}
```

- [ ] **Step 2: 创建 `app/api/topics/[id]/versions/route.ts`**

```typescript
import { getTopic, getContentVersions } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const ageGroup = searchParams.get("age_group") || topic.age_group;
  const language = searchParams.get("language") || topic.language;

  const versions = getContentVersions(params.id, ageGroup, language);

  return Response.json({ topic_id: params.id, versions });
}
```

- [ ] **Step 3: 创建 `app/api/topics/[id]/versions/[versionId]/route.ts`**

```typescript
import { deleteVersion } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string; versionId: string } }) {
  deleteVersion(params.versionId);
  return Response.json({ status: "deleted" });
}
```

- [ ] **Step 4: 创建 `app/api/topics/[id]/versions/[versionId]/activate/route.ts`**

```typescript
import { activateVersion } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function PUT(_req: Request, { params }: { params: { id: string; versionId: string } }) {
  activateVersion(params.versionId);
  return Response.json({ status: "activated", version_id: params.versionId });
}
```

- [ ] **Step 5: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 6: Commit**

```bash
git add app/api/topics/
git commit -m "feat(p7): add generate, versions, and version management API routes"
```

---

### Task 6: API 路由 — 智能推荐

**Files:**
- Create: `app/api/topics/suggestions/route.ts`
- Create: `app/api/topics/suggestions/[id]/route.ts`

**Interfaces:**
- Consumes: `getPendingSuggestions`, `reviewSuggestion`, `createTopic` from Task 2
- Consumes: `TopicSuggestion` from Task 1

- [ ] **Step 1: 创建 `app/api/topics/suggestions/route.ts`**

```typescript
import { getPendingSuggestions } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function GET() {
  const suggestions = getPendingSuggestions();
  return Response.json({ suggestions });
}
```

- [ ] **Step 2: 创建 `app/api/topics/suggestions/[id]/route.ts`**

```typescript
import { reviewSuggestion, createTopic } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { status, topic_title, topic_summary, category, age_group, language } = await req.json();

  if (!status || !["approved", "rejected"].includes(status)) {
    return Response.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }

  if (status === "approved" && (!topic_title || !topic_summary || !category || !age_group)) {
    return Response.json(
      { error: "approved suggestions require topic_title, topic_summary, category, and age_group" },
      { status: 400 }
    );
  }

  if (status === "approved") {
    // Create the topic from the approved suggestion
    createTopic({
      title: topic_title,
      summary: topic_summary,
      category,
      age_group,
      language: language || "zh-CN",
      source: "auto_suggested",
    });
  }

  reviewSuggestion(params.id, status);
  return Response.json({ status: "reviewed", suggestion_id: params.id, result: status });
}
```

- [ ] **Step 3: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 4: Commit**

```bash
git add app/api/topics/suggestions/
git commit -m "feat(p7): add suggestion review API routes"
```

---

### Task 7: 种子数据迁移

**Files:**
- Create: `scripts/seed-topics.ts`

**Interfaces:**
- Consumes: `createTopic` from Task 2
- Produces: 192 条种子话题（64 话题 × 3 语言），可通过 `npx tsx scripts/seed-topics.ts` 运行

- [ ] **Step 1: 创建种子话题数据结构**

创建 `scripts/seed-topics.ts`:

```typescript
/**
 * P7 种子话题迁移脚本
 * 运行: npx tsx scripts/seed-topics.ts
 *
 * 64 个种子话题 × 3 种语言（zh-CN / zh-HK / en）= 192 行 topic_catalog
 * 仅在 topic_catalog 表为空时插入（幂等保护）
 */

import { getDb } from "../lib/db/index";

interface SeedTopic {
  id: string;
  category: string;
  age_group: string;
  interest_tag: string | null;
  zhCN: { title: string; summary: string; cover_image: string };
  zhHK: { title: string; summary: string; cover_image: string };
  en: { title: string; summary: string; cover_image: string };
}

const SEED_TOPICS: SeedTopic[] = [
  // ═══════ 🔬 探索创造 · 自然科学 ═══════
  {
    id: "seed-nature-01", category: "自然科学", age_group: "6-9", interest_tag: "恐龙",
    zhCN: { title: "恐龙世界", summary: "探索远古巨兽的奇妙世界，认识不同种类的恐龙", cover_image: "🦕" },
    zhHK: { title: "恐龍世界", summary: "探索遠古巨獸的奇妙世界，認識不同種類的恐龍", cover_image: "🦕" },
    en: { title: "Dinosaur World", summary: "Explore the amazing world of prehistoric giants and meet different kinds of dinosaurs", cover_image: "🦕" },
  },
  {
    id: "seed-nature-02", category: "自然科学", age_group: "6-9", interest_tag: null,
    zhCN: { title: "神奇的动物", summary: "从会变色的章鱼到会飞的松鼠，探索动物王国的神奇本领", cover_image: "🐙" },
    zhHK: { title: "神奇的動物", summary: "從會變色的八爪魚到會飛的松鼠，探索動物王國的神奇本領", cover_image: "🐙" },
    en: { title: "Amazing Animals", summary: "From color-changing octopuses to flying squirrels — discover nature's superpowers", cover_image: "🐙" },
  },
  {
    id: "seed-nature-03", category: "自然科学", age_group: "6-9", interest_tag: null,
    zhCN: { title: "天气魔法", summary: "为什么会下雨？彩虹是怎么来的？一起探索天气的奥秘", cover_image: "🌈" },
    zhHK: { title: "天氣魔法", summary: "為什麼會下雨？彩虹是怎樣來的？一起探索天氣的奧秘", cover_image: "🌈" },
    en: { title: "Weather Magic", summary: "Why does it rain? How do rainbows form? Explore the secrets of weather together", cover_image: "🌈" },
  },
  {
    id: "seed-nature-04", category: "自然科学", age_group: "10-12", interest_tag: "太空",
    zhCN: { title: "太阳系漫游", summary: "从水星到海王星，带你游历太阳系八大行星", cover_image: "🪐" },
    zhHK: { title: "太陽系漫遊", summary: "從水星到海王星，帶你遊歷太陽系八大行星", cover_image: "🪐" },
    en: { title: "Solar System Tour", summary: "Journey through all eight planets from Mercury to Neptune", cover_image: "🪐" },
  },
  {
    id: "seed-nature-05", category: "自然科学", age_group: "10-12", interest_tag: null,
    zhCN: { title: "人体奥秘", summary: "你的身体是一座精密的工厂——了解器官如何协作维持生命", cover_image: "🫀" },
    zhHK: { title: "人體奧秘", summary: "你的身體是一座精密的工廠——了解器官如何協作維持生命", cover_image: "🫀" },
    en: { title: "Human Body Mysteries", summary: "Your body is a precision factory — learn how organs work together to keep you alive", cover_image: "🫀" },
  },
  {
    id: "seed-nature-06", category: "自然科学", age_group: "10-12", interest_tag: "海洋",
    zhCN: { title: "海洋深处", summary: "探索深海热泉、发光的生物，以及人类尚未完全了解的神秘世界", cover_image: "🌊" },
    zhHK: { title: "海洋深處", summary: "探索深海熱泉、發光的生物，以及人類尚未完全了解的神秘世界", cover_image: "🌊" },
    en: { title: "Deep Ocean", summary: "Explore hydrothermal vents, glowing creatures, and a mysterious world not yet fully known", cover_image: "🌊" },
  },
  {
    id: "seed-nature-07", category: "自然科学", age_group: "13-15", interest_tag: null,
    zhCN: { title: "量子世界入门", summary: "从双缝实验到量子纠缠，了解微观世界的奇异法则", cover_image: "⚛️" },
    zhHK: { title: "量子世界入門", summary: "從雙縫實驗到量子糾纏，了解微觀世界的奇異法則", cover_image: "⚛️" },
    en: { title: "Intro to Quantum World", summary: "From the double-slit experiment to quantum entanglement — the strange rules of the microscopic", cover_image: "⚛️" },
  },
  {
    id: "seed-nature-08", category: "自然科学", age_group: "13-15", interest_tag: null,
    zhCN: { title: "基因的秘密", summary: "DNA 如何决定你的眼睛颜色？基因编辑技术 CRISPR 又将改变什么？", cover_image: "🧬" },
    zhHK: { title: "基因的秘密", summary: "DNA 如何決定你的眼睛顏色？基因編輯技術 CRISPR 又將改變什麼？", cover_image: "🧬" },
    en: { title: "Secrets of Genes", summary: "How does DNA determine your eye colour? What will gene editing technology CRISPR change?", cover_image: "🧬" },
  },
  {
    id: "seed-nature-09", category: "自然科学", age_group: "13-15", interest_tag: null,
    zhCN: { title: "气候变化", summary: "全球变暖的科学原理、影响，以及我们可以做些什么", cover_image: "🌍" },
    zhHK: { title: "氣候變化", summary: "全球暖化的科學原理、影響，以及我們可以做些什麼", cover_image: "🌍" },
    en: { title: "Climate Change", summary: "The science of global warming, its impacts, and what we can do about it", cover_image: "🌍" },
  },

  // ═══════ 🔬 探索创造 · 技术编程 ═══════
  {
    id: "seed-tech-01", category: "技术编程", age_group: "6-9", interest_tag: null,
    zhCN: { title: "机器人朋友", summary: "认识不同类型的机器人，了解它们如何帮助人类工作与生活", cover_image: "🤖" },
    zhHK: { title: "機械人朋友", summary: "認識不同類型的機械人，了解它們如何幫助人類工作與生活", cover_image: "🤖" },
    en: { title: "Robot Friends", summary: "Meet different types of robots and learn how they help humans work and live", cover_image: "🤖" },
  },
  {
    id: "seed-tech-02", category: "技术编程", age_group: "6-9", interest_tag: null,
    zhCN: { title: "指令游戏", summary: "像给机器人下指令一样思考——学习顺序思维的基础", cover_image: "🎮" },
    zhHK: { title: "指令遊戲", summary: "像給機械人下指令一樣思考——學習順序思維的基礎", cover_image: "🎮" },
    en: { title: "Command Games", summary: "Think like giving instructions to a robot — learn the basics of sequential thinking", cover_image: "🎮" },
  },
  {
    id: "seed-tech-03", category: "技术编程", age_group: "10-12", interest_tag: "编程",
    zhCN: { title: "Scratch大冒险", summary: "用 Scratch 创作你的第一个动画、游戏和互动故事", cover_image: "🐱" },
    zhHK: { title: "Scratch大冒險", summary: "用 Scratch 創作你的第一個動畫、遊戲和互動故事", cover_image: "🐱" },
    en: { title: "Scratch Adventures", summary: "Create your first animations, games, and interactive stories with Scratch", cover_image: "🐱" },
  },
  {
    id: "seed-tech-04", category: "技术编程", age_group: "10-12", interest_tag: "编程",
    zhCN: { title: "APP怎么来的", summary: "从想法到上架——揭秘手机应用是如何被创造出来的", cover_image: "📱" },
    zhHK: { title: "APP點樣嚟", summary: "從想法到上架——揭秘手機應用程式是如何被創造出來的", cover_image: "📱" },
    en: { title: "How Apps Are Made", summary: "From idea to app store — reveal how mobile apps are created", cover_image: "📱" },
  },
  {
    id: "seed-tech-05", category: "技术编程", age_group: "13-15", interest_tag: "编程",
    zhCN: { title: "网页是怎样建成的", summary: "HTML、CSS、JavaScript——构建互联网的三块基石", cover_image: "🌐" },
    zhHK: { title: "網頁是怎樣建成的", summary: "HTML、CSS、JavaScript——構建互聯網的三塊基石", cover_image: "🌐" },
    en: { title: "How Websites Are Built", summary: "HTML, CSS, JavaScript — the three building blocks of the internet", cover_image: "🌐" },
  },
  {
    id: "seed-tech-06", category: "技术编程", age_group: "13-15", interest_tag: null,
    zhCN: { title: "AI是什么", summary: "从图灵测试到大语言模型，理解人工智能的核心概念与发展历程", cover_image: "🧠" },
    zhHK: { title: "AI係咩", summary: "從圖靈測試到大語言模型，理解人工智能的核心概念與發展歷程", cover_image: "🧠" },
    en: { title: "What Is AI", summary: "From the Turing Test to large language models — understand the core concepts and evolution of AI", cover_image: "🧠" },
  },

  // ═══════ 🔬 探索创造 · 视觉艺术 ═══════
  {
    id: "seed-art-01", category: "视觉艺术", age_group: "6-9", interest_tag: "绘画",
    zhCN: { title: "颜色魔法", summary: "红加蓝变紫？探索颜色混合的奇妙世界", cover_image: "🎨" },
    zhHK: { title: "顏色魔法", summary: "紅加藍變紫？探索顏色混合的奇妙世界", cover_image: "🎨" },
    en: { title: "Color Magic", summary: "Red plus blue makes purple? Explore the wonderful world of colour mixing", cover_image: "🎨" },
  },
  {
    id: "seed-art-02", category: "视觉艺术", age_group: "6-9", interest_tag: null,
    zhCN: { title: "泥巴大变身", summary: "用黏土和橡皮泥创造属于你的小世界", cover_image: "🏺" },
    zhHK: { title: "泥巴大變身", summary: "用黏土和橡皮泥創造屬於你的小世界", cover_image: "🏺" },
    en: { title: "Clay Creations", summary: "Use clay and playdough to create your own little world", cover_image: "🏺" },
  },
  {
    id: "seed-art-03", category: "视觉艺术", age_group: "10-12", interest_tag: "绘画",
    zhCN: { title: "漫画入门", summary: "从分镜到角色设计，学习创作属于你自己的漫画", cover_image: "📖" },
    zhHK: { title: "漫畫入門", summary: "從分鏡到角色設計，學習創作屬於你自己的漫畫", cover_image: "📖" },
    en: { title: "Intro to Comics", summary: "From storyboarding to character design — learn to create your own comics", cover_image: "📖" },
  },
  {
    id: "seed-art-04", category: "视觉艺术", age_group: "10-12", interest_tag: null,
    zhCN: { title: "摄影构图", summary: "学会用镜头讲故事——三分法、引导线和光线运用", cover_image: "📷" },
    zhHK: { title: "攝影構圖", summary: "學會用鏡頭講故事——三分法、引導線和光線運用", cover_image: "📷" },
    en: { title: "Photo Composition", summary: "Learn to tell stories with your lens — rule of thirds, leading lines, and lighting", cover_image: "📷" },
  },
  {
    id: "seed-art-05", category: "视觉艺术", age_group: "13-15", interest_tag: null,
    zhCN: { title: "设计思维", summary: "从用户需求到产品原型，学习设计师如何解决问题", cover_image: "💡" },
    zhHK: { title: "設計思維", summary: "從用戶需求到產品原型，學習設計師如何解決問題", cover_image: "💡" },
    en: { title: "Design Thinking", summary: "From user needs to product prototypes — learn how designers solve problems", cover_image: "💡" },
  },
  {
    id: "seed-art-06", category: "视觉艺术", age_group: "13-15", interest_tag: null,
    zhCN: { title: "动画原理", summary: "从翻页动画到 CGI——理解运动影像背后的核心技术", cover_image: "🎬" },
    zhHK: { title: "動畫原理", summary: "從翻頁動畫到CGI——理解運動影像背後的核心技術", cover_image: "🎬" },
    en: { title: "Animation Principles", summary: "From flipbooks to CGI — understand the core techniques behind moving images", cover_image: "🎬" },
  },

  // ═══════ 🔬 探索创造 · 音乐表演 ═══════
  {
    id: "seed-music-01", category: "音乐表演", age_group: "6-9", interest_tag: null,
    zhCN: { title: "声音的秘密", summary: "声音是怎么产生的？为什么不同的乐器有不同的音色？", cover_image: "🔊" },
    zhHK: { title: "聲音的秘密", summary: "聲音是怎樣產生的？為什麼不同的樂器有不同的音色？", cover_image: "🔊" },
    en: { title: "Secrets of Sound", summary: "How is sound produced? Why do different instruments have different timbres?", cover_image: "🔊" },
  },
  {
    id: "seed-music-02", category: "音乐表演", age_group: "6-9", interest_tag: null,
    zhCN: { title: "身体打击乐", summary: "用拍手、跺脚、打响指创造节奏——你的身体就是乐器", cover_image: "👏" },
    zhHK: { title: "身體打擊樂", summary: "用拍手、跺腳、打響指創造節奏——你的身體就是樂器", cover_image: "👏" },
    en: { title: "Body Percussion", summary: "Create rhythms with claps, stomps, and snaps — your body is the instrument", cover_image: "👏" },
  },
  {
    id: "seed-music-03", category: "音乐表演", age_group: "10-12", interest_tag: null,
    zhCN: { title: "认识乐器家族", summary: "弦乐、管乐、打击乐——了解交响乐团里的四个乐器家族", cover_image: "🎻" },
    zhHK: { title: "認識樂器家族", summary: "弦樂、管樂、打擊樂——了解交響樂團裏的四個樂器家族", cover_image: "🎻" },
    en: { title: "Meet the Instrument Families", summary: "Strings, winds, percussion — discover the four instrument families of an orchestra", cover_image: "🎻" },
  },
  {
    id: "seed-music-04", category: "音乐表演", age_group: "10-12", interest_tag: null,
    zhCN: { title: "节奏创作", summary: "学习节拍基础，创作你自己的节奏模式", cover_image: "🥁" },
    zhHK: { title: "節奏創作", summary: "學習節拍基礎，創作你自己的節奏模式", cover_image: "🥁" },
    en: { title: "Rhythm Crafting", summary: "Learn the basics of beat and create your own rhythm patterns", cover_image: "🥁" },
  },
  {
    id: "seed-music-05", category: "音乐表演", age_group: "13-15", interest_tag: null,
    zhCN: { title: "音乐制作入门", summary: "用免费数字音频工作站 DAW 创作你的第一首电子音乐", cover_image: "🎹" },
    zhHK: { title: "音樂製作入門", summary: "用免費數碼音頻工作站 DAW 創作你的第一首電子音樂", cover_image: "🎹" },
    en: { title: "Intro to Music Production", summary: "Create your first electronic track with free digital audio workstations", cover_image: "🎹" },
  },
  {
    id: "seed-music-06", category: "音乐表演", age_group: "13-15", interest_tag: null,
    zhCN: { title: "歌曲结构分析", summary: "主歌、副歌、桥段——解构流行歌曲的创作公式", cover_image: "🎵" },
    zhHK: { title: "歌曲結構分析", summary: "主歌、副歌、橋段——解構流行歌曲的創作公式", cover_image: "🎵" },
    en: { title: "Song Structure Analysis", summary: "Verse, chorus, bridge — deconstruct the formula behind pop songs", cover_image: "🎵" },
  },

  // ═══════ 📚 文化根基 · 历史长廊 ═══════
  {
    id: "seed-history-01", category: "历史长廊", age_group: "6-9", interest_tag: null,
    zhCN: { title: "如果生活在古代", summary: "没有手机、没有电的古代，小朋友的一天是怎么过的？", cover_image: "🏛️" },
    zhHK: { title: "如果生活在古代", summary: "沒有手機、沒有電的古代，小朋友的一天是怎樣過的？", cover_image: "🏛️" },
    en: { title: "Life in Ancient Times", summary: "No phones, no electricity — what was a child's day like in ancient times?", cover_image: "🏛️" },
  },
  {
    id: "seed-history-02", category: "历史长廊", age_group: "6-9", interest_tag: null,
    zhCN: { title: "四大发明", summary: "造纸术、指南针、火药、印刷术——改变世界的四个中国发明", cover_image: "📜" },
    zhHK: { title: "四大發明", summary: "造紙術、指南針、火藥、印刷術——改變世界的四個中國發明", cover_image: "📜" },
    en: { title: "The Four Great Inventions", summary: "Paper, compass, gunpowder, printing — four Chinese inventions that changed the world", cover_image: "📜" },
  },
  {
    id: "seed-history-03", category: "历史长廊", age_group: "10-12", interest_tag: null,
    zhCN: { title: "丝绸之路", summary: "跟随商队的足迹，穿越连接东方与西方千年的贸易网络", cover_image: "🐪" },
    zhHK: { title: "絲綢之路", summary: "跟隨商隊的足跡，穿越連接東方與西方千年的貿易網絡", cover_image: "🐪" },
    en: { title: "The Silk Road", summary: "Follow the footsteps of caravans across the millennium-old trade network linking East and West", cover_image: "🐪" },
  },
  {
    id: "seed-history-04", category: "历史长廊", age_group: "10-12", interest_tag: null,
    zhCN: { title: "古罗马兴衰", summary: "从一个城邦到庞大帝国——罗马如何崛起，又为何衰落？", cover_image: "🏟️" },
    zhHK: { title: "古羅馬興衰", summary: "從一個城邦到龐大帝國——羅馬如何崛起，又為何衰落？", cover_image: "🏟️" },
    en: { title: "Rise and Fall of Rome", summary: "From city-state to vast empire — how did Rome rise and why did it fall?", cover_image: "🏟️" },
  },
  {
    id: "seed-history-05", category: "历史长廊", age_group: "13-15", interest_tag: null,
    zhCN: { title: "文明的碰撞", summary: "哥伦布抵达美洲后——两种文明的相遇如何重塑了世界格局", cover_image: "⛵" },
    zhHK: { title: "文明的碰撞", summary: "哥倫布抵達美洲後——兩種文明的相遇如何重塑了世界格局", cover_image: "⛵" },
    en: { title: "Clash of Civilisations", summary: "After Columbus reached the Americas — how two worlds collided and reshaped the globe", cover_image: "⛵" },
  },
  {
    id: "seed-history-06", category: "历史长廊", age_group: "13-15", interest_tag: null,
    zhCN: { title: "二十世纪改变世界的十件事", summary: "从世界大战争到互联网——回顾塑造现代世界的十个关键事件", cover_image: "📰" },
    zhHK: { title: "二十世紀改變世界的十件事", summary: "從世界大戰到互聯網——回顧塑造現代世界的十個關鍵事件", cover_image: "📰" },
    en: { title: "10 Events That Changed the 20th Century", summary: "From world wars to the internet — ten key events that shaped the modern world", cover_image: "📰" },
  },

  // ═══════ 📚 文化根基 · 国学经典 ═══════
  {
    id: "seed-guoxue-01", category: "国学经典", age_group: "6-9", interest_tag: null,
    zhCN: { title: "成语里的故事", summary: "每个成语背后都藏着一个精彩的故事——一起来成语王国探险", cover_image: "📚" },
    zhHK: { title: "成語裏的故事", summary: "每個成語背後都藏着一個精彩的故事——一起來成語王國探險", cover_image: "📚" },
    en: { title: "Stories Behind Chinese Idioms", summary: "Every Chinese idiom hides a wonderful story — let's explore the idiom kingdom", cover_image: "📚" },
  },
  {
    id: "seed-guoxue-02", category: "国学经典", age_group: "6-9", interest_tag: null,
    zhCN: { title: "孔子的智慧", summary: "两千多年前的老师孔子，说了哪些至今仍有用的话？", cover_image: "🎓" },
    zhHK: { title: "孔子的智慧", summary: "兩千多年前的老師孔子，說了些至今仍有用的話？", cover_image: "🎓" },
    en: { title: "Wisdom of Confucius", summary: "What did the great teacher Confucius say over 2,000 years ago that is still useful today?", cover_image: "🎓" },
  },
  {
    id: "seed-guoxue-03", category: "国学经典", age_group: "10-12", interest_tag: null,
    zhCN: { title: "三十六计", summary: "从"瞒天过海"到"走为上计"——古代兵法的智慧在今天的应用", cover_image: "⚔️" },
    zhHK: { title: "三十六計", summary: "從「瞞天過海」到「走為上計」——古代兵法的智慧在今天的應用", cover_image: "⚔️" },
    en: { title: "The 36 Stratagems", summary: "From 'Deceive the Heavens' to 'Retreat Is the Best Option' — ancient strategic wisdom for modern life", cover_image: "⚔️" },
  },
  {
    id: "seed-guoxue-04", category: "国学经典", age_group: "10-12", interest_tag: null,
    zhCN: { title: "古文小故事", summary: "阅读短小精悍的古文名篇，感受文言文的韵律之美", cover_image: "📖" },
    zhHK: { title: "古文小故事", summary: "閱讀短小精悍的古文名篇，感受文言文的韻律之美", cover_image: "📖" },
    en: { title: "Classical Chinese Tales", summary: "Read short and elegant classical Chinese texts and appreciate the beauty of literary rhythm", cover_image: "📖" },
  },
  {
    id: "seed-guoxue-05", category: "国学经典", age_group: "13-15", interest_tag: null,
    zhCN: { title: "老庄哲学入门", summary: "无为而治、逍遥游——理解道家思想的核心主张", cover_image: "☯️" },
    zhHK: { title: "老莊哲學入門", summary: "無為而治、逍遙遊——理解道家思想的核心主張", cover_image: "☯️" },
    en: { title: "Intro to Daoist Philosophy", summary: "Wu Wei, the Carefree Journey — understand the core ideas of Daoist thought", cover_image: "☯️" },
  },
  {
    id: "seed-guoxue-06", category: "国学经典", age_group: "13-15", interest_tag: null,
    zhCN: { title: "资治通鉴选读", summary: "从三家分晋到安史之乱——历史长河中的治理智慧", cover_image: "📜" },
    zhHK: { title: "資治通鑑選讀", summary: "從三家分晉到安史之亂——歷史長河中的治理智慧", cover_image: "📜" },
    en: { title: "Zizhi Tongjian Selections", summary: "From the Partition of Jin to the An Lushan Rebellion — governance wisdom across history", cover_image: "📜" },
  },

  // ═══════ 📚 文化根基 · 诗词歌赋 ═══════
  {
    id: "seed-poetry-01", category: "诗词歌赋", age_group: "6-9", interest_tag: null,
    zhCN: { title: "跟着唐诗去旅行", summary: "读一首诗，看一处风景——唐诗里的山水和远方", cover_image: "⛰️" },
    zhHK: { title: "跟着唐詩去旅行", summary: "讀一首詩，看一處風景——唐詩裏的山水和遠方", cover_image: "⛰️" },
    en: { title: "Travel with Tang Poems", summary: "Read a poem, see a landscape — mountains, rivers, and faraway places in Tang Dynasty poetry", cover_image: "⛰️" },
  },
  {
    id: "seed-poetry-02", category: "诗词歌赋", age_group: "6-9", interest_tag: null,
    zhCN: { title: "宋词里的四季", summary: "春天花开、夏夜蝉鸣——宋词怎样描绘大自然的四季变化", cover_image: "🌸" },
    zhHK: { title: "宋詞裏的四季", summary: "春天花開、夏夜蟬鳴——宋詞怎樣描繪大自然的四季變化", cover_image: "🌸" },
    en: { title: "Four Seasons in Song Lyrics", summary: "Spring blossoms, summer cicadas — how Song Dynasty lyrics depict nature's four seasons", cover_image: "🌸" },
  },
  {
    id: "seed-poetry-03", category: "诗词歌赋", age_group: "10-12", interest_tag: null,
    zhCN: { title: "李白与杜甫", summary: "诗仙与诗圣——两位最伟大的唐代诗人，他们的人生与作品", cover_image: "🍶" },
    zhHK: { title: "李白與杜甫", summary: "詩仙與詩聖——兩位最偉大的唐代詩人，他們的人生與作品", cover_image: "🍶" },
    en: { title: "Li Bai and Du Fu", summary: "The Immortal Poet and the Sage Poet — the lives and works of Tang's two greatest poets", cover_image: "🍶" },
  },
  {
    id: "seed-poetry-04", category: "诗词歌赋", age_group: "10-12", interest_tag: null,
    zhCN: { title: "词牌里的故事", summary: "水调歌头、蝶恋花——每个词牌名背后都有动人的故事", cover_image: "🎶" },
    zhHK: { title: "詞牌裏的故事", summary: "水調歌頭、蝶戀花——每個詞牌名背後都有動人的故事", cover_image: "🎶" },
    en: { title: "Stories of Ci Tune Names", summary: "Each classical Chinese lyric tune name holds a moving story behind it", cover_image: "🎶" },
  },
  {
    id: "seed-poetry-05", category: "诗词歌赋", age_group: "13-15", interest_tag: null,
    zhCN: { title: "古典诗词鉴赏", summary: "学习格律、意象与用典——掌握深度赏析古诗词的方法", cover_image: "📝" },
    zhHK: { title: "古典詩詞鑒賞", summary: "學習格律、意象與用典——掌握深度賞析古詩詞的方法", cover_image: "📝" },
    en: { title: "Classical Poetry Appreciation", summary: "Learn metre, imagery, and allusion — master the art of deep poetry analysis", cover_image: "📝" },
  },
  {
    id: "seed-poetry-06", category: "诗词歌赋", age_group: "13-15", interest_tag: null,
    zhCN: { title: "现代诗创作", summary: "打破格律的束缚——用自由诗表达属于我们这个时代的声音", cover_image: "✒️" },
    zhHK: { title: "現代詩創作", summary: "打破格律的束縛——用自由詩表達屬於我們這個時代的聲音", cover_image: "✒️" },
    en: { title: "Writing Modern Poetry", summary: "Break free from metre — use free verse to express the voice of our time", cover_image: "✒️" },
  },

  // ═══════ 📚 文化根基 · 中医智慧 ═══════
  {
    id: "seed-tcm-01", category: "中医智慧", age_group: "6-9", interest_tag: null,
    zhCN: { title: "身体里的小卫士", summary: "中医说身体里有"正气"保护我们——它和免疫力是什么关系？", cover_image: "🛡️" },
    zhHK: { title: "身體裏的小衞士", summary: "中醫說身體裏有「正氣」保護我們——它和免疫力是什麼關係？", cover_image: "🛡️" },
    en: { title: "Your Body's Little Guardians", summary: "Chinese medicine says 'Zheng Qi' protects us — how does it relate to immunity?", cover_image: "🛡️" },
  },
  {
    id: "seed-tcm-02", category: "中医智慧", age_group: "6-9", interest_tag: null,
    zhCN: { title: "神奇的中草药", summary: "薄荷清凉、生姜温热——认识身边常见中草药的性味与功用", cover_image: "🌿" },
    zhHK: { title: "神奇的中草藥", summary: "薄荷清涼、生薑溫熱——認識身邊常見中草藥的性味與功用", cover_image: "🌿" },
    en: { title: "Magical Chinese Herbs", summary: "Mint is cooling, ginger is warming — discover the properties and uses of common herbs", cover_image: "🌿" },
  },
  {
    id: "seed-tcm-03", category: "中医智慧", age_group: "10-12", interest_tag: null,
    zhCN: { title: "经络与穴位", summary: "人体内的"高速公路"——认识经络系统和重要保健穴位", cover_image: "🔬" },
    zhHK: { title: "經絡與穴位", summary: "人體內的「高速公路」——認識經絡系統和重要保健穴位", cover_image: "🔬" },
    en: { title: "Meridians and Acupoints", summary: "The 'highways' inside your body — discover the meridian system and key health points", cover_image: "🔬" },
  },
  {
    id: "seed-tcm-04", category: "中医智慧", age_group: "10-12", interest_tag: null,
    zhCN: { title: "饮食与节气", summary: "为什么冬天要吃萝卜，夏天要喝绿豆汤？——节气饮食的科学", cover_image: "🍲" },
    zhHK: { title: "飲食與節氣", summary: "為什麼冬天要吃蘿蔔，夏天要喝綠豆湯？——節氣飲食的科學", cover_image: "🍲" },
    en: { title: "Food and the Solar Terms", summary: "Why eat radish in winter and mung bean soup in summer? The science of seasonal eating", cover_image: "🍲" },
  },
  {
    id: "seed-tcm-05", category: "中医智慧", age_group: "13-15", interest_tag: null,
    zhCN: { title: "中医基础理论", summary: "阴阳、五行、藏象——理解中医认识人体的独特框架", cover_image: "☯️" },
    zhHK: { title: "中醫基礎理論", summary: "陰陽、五行、藏象——理解中醫認識人體的獨特框架", cover_image: "☯️" },
    en: { title: "Fundamentals of Chinese Medicine", summary: "Yin-Yang, Five Elements, Organ Systems — the unique framework for understanding the human body", cover_image: "☯️" },
  },
  {
    id: "seed-tcm-06", category: "中医智慧", age_group: "13-15", interest_tag: null,
    zhCN: { title: "中西医对话", summary: "同一个疾病，两种不同的诊断思路——比较中西医的思维方式", cover_image: "🏥" },
    zhHK: { title: "中西醫對話", summary: "同一個疾病，兩種不同的診斷思路——比較中西醫的思維方式", cover_image: "🏥" },
    en: { title: "East-West Medical Dialogue", summary: "Same illness, two diagnostic approaches — comparing Chinese and Western medical thinking", cover_image: "🏥" },
  },

  // ═══════ 🎯 学业赋能 · 中文精进 ═══════
  {
    id: "seed-chinese-01", category: "中文精进", age_group: "6-9", interest_tag: null,
    zhCN: { title: "汉字的故事", summary: "每个汉字都是一幅画——从甲骨文到楷书的演变之旅", cover_image: "🔤" },
    zhHK: { title: "漢字的故事", summary: "每個漢字都是一幅畫——從甲骨文到楷書的演變之旅", cover_image: "🔤" },
    en: { title: "Stories of Chinese Characters", summary: "Every character is a picture — a journey from oracle bone script to regular script", cover_image: "🔤" },
  },
  {
    id: "seed-chinese-02", category: "中文精进", age_group: "6-9", interest_tag: null,
    zhCN: { title: "有趣的部首", summary: ""氵"和"火"——认识偏旁部首，轻松猜汉字的意思", cover_image: "🔍" },
    zhHK: { title: "有趣的部首", summary: "「氵」和「火」——認識偏旁部首，輕鬆估漢字的意思", cover_image: "🔍" },
    en: { title: "Fun with Radicals", summary: "Water radical and fire radical — learn character components to guess meanings easily", cover_image: "🔍" },
  },
  {
    id: "seed-chinese-03", category: "中文精进", age_group: "6-9", interest_tag: null,
    zhCN: { title: "看图说故事", summary: "观察图片细节，组织语言——培养口语表达和叙事能力", cover_image: "🖼️" },
    zhHK: { title: "看圖說故事", summary: "觀察圖片細節，組織語言——培養口語表達和敘事能力", cover_image: "🖼️" },
    en: { title: "Picture Storytelling", summary: "Observe details in pictures and organise your thoughts — build oral expression and narrative skills", cover_image: "🖼️" },
  },
  {
    id: "seed-chinese-04", category: "中文精进", age_group: "10-12", interest_tag: null,
    zhCN: { title: "阅读理解大揭秘", summary: "找主旨、理结构、抓细节——掌握阅读理解的关键策略", cover_image: "📖" },
    zhHK: { title: "閱讀理解大揭秘", summary: "找主旨、理結構、抓細節——掌握閱讀理解的關鍵策略", cover_image: "📖" },
    en: { title: "Reading Comprehension Secrets", summary: "Find the main idea, map the structure, catch the details — key strategies for reading comprehension", cover_image: "📖" },
  },
  {
    id: "seed-chinese-05", category: "中文精进", age_group: "10-12", interest_tag: null,
    zhCN: { title: "作文小达人", summary: "从写清楚到写精彩——掌握记叙文、说明文的写作技巧", cover_image: "✏️" },
    zhHK: { title: "作文小達人", summary: "從寫清楚到寫精彩——掌握記敘文、說明文的寫作技巧", cover_image: "✏️" },
    en: { title: "Young Writing Pro", summary: "From clear to compelling — master narrative and expository writing techniques", cover_image: "✏️" },
  },
  {
    id: "seed-chinese-06", category: "中文精进", age_group: "10-12", interest_tag: null,
    zhCN: { title: "成语活用术", summary: "不只背诵成语，更学会在说话和写作中灵活运用成语", cover_image: "📝" },
    zhHK: { title: "成語活用術", summary: "不只背誦成語，更學會在說話和寫作中靈活運用成語", cover_image: "📝" },
    en: { title: "Idiom Mastery", summary: "Beyond memorisation — learn to use Chinese idioms naturally in speech and writing", cover_image: "📝" },
  },

  // ═══════ 🎯 学业赋能 · 英文探索 ═══════
  {
    id: "seed-english-01", category: "英文探索", age_group: "6-9", interest_tag: null,
    zhCN: { title: "My First Story", summary: "用简单的英文句子创作属于你的第一本英文绘本故事", cover_image: "📕" },
    zhHK: { title: "My First Story", summary: "用簡單的英文句子創作屬於你的第一本英文繪本故事", cover_image: "📕" },
    en: { title: "My First Story", summary: "Create your very first English picture book story with simple sentences", cover_image: "📕" },
  },
  {
    id: "seed-english-02", category: "英文探索", age_group: "6-9", interest_tag: null,
    zhCN: { title: "Fun with Phonics", summary: "通过好玩的发音游戏，掌握英语自然拼读的规律", cover_image: "🔊" },
    zhHK: { title: "Fun with Phonics", summary: "通過好玩的發音遊戲，掌握英語自然拼讀的規律", cover_image: "🔊" },
    en: { title: "Fun with Phonics", summary: "Master English phonics patterns through playful sound games", cover_image: "🔊" },
  },
  {
    id: "seed-english-03", category: "英文探索", age_group: "10-12", interest_tag: null,
    zhCN: { title: "Reading Detectives", summary: "像侦探一样阅读——学会预测、推断和归纳英文文章内容", cover_image: "🔎" },
    zhHK: { title: "Reading Detectives", summary: "像偵探一樣閱讀——學會預測、推斷和歸納英文文章內容", cover_image: "🔎" },
    en: { title: "Reading Detectives", summary: "Read like a detective — learn to predict, infer, and summarise English texts", cover_image: "🔎" },
  },
  {
    id: "seed-english-04", category: "英文探索", age_group: "10-12", interest_tag: null,
    zhCN: { title: "Creative Writing", summary: "从日记到短篇故事——用英文表达你的想象力和观点", cover_image: "✍️" },
    zhHK: { title: "Creative Writing", summary: "從日記到短篇故事——用英文表達你的想像力和觀點", cover_image: "✍️" },
    en: { title: "Creative Writing", summary: "From journal entries to short stories — express your imagination and opinions in English", cover_image: "✍️" },
  },
  {
    id: "seed-english-05", category: "英文探索", age_group: "10-12", interest_tag: null,
    zhCN: { title: "Speak & Shine", summary: "克服开口恐惧——实用的英语口语练习和演讲技巧", cover_image: "🎤" },
    zhHK: { title: "Speak & Shine", summary: "克服開口恐懼——實用的英語口語練習和演講技巧", cover_image: "🎤" },
    en: { title: "Speak & Shine", summary: "Overcome the fear of speaking — practical oral English practice and presentation skills", cover_image: "🎤" },
  },

  // ═══════ 🎯 学业赋能 · 数学思维 ═══════
  {
    id: "seed-math-01", category: "数学思维", age_group: "6-9", interest_tag: null,
    zhCN: { title: "生活中的数学", summary: "超市购物、搭积木、分糖果——数学就在你身边", cover_image: "🛒" },
    zhHK: { title: "生活中的數學", summary: "超市購物、砌積木、分糖果——數學就在你身邊", cover_image: "🛒" },
    en: { title: "Math in Everyday Life", summary: "Supermarket shopping, building blocks, sharing sweets — maths is all around you", cover_image: "🛒" },
  },
  {
    id: "seed-math-02", category: "数学思维", age_group: "6-9", interest_tag: null,
    zhCN: { title: "图形魔法师", summary: "认识三角形、正方形和圆——用几何图形拼出无限创意", cover_image: "🔺" },
    zhHK: { title: "圖形魔法師", summary: "認識三角形、正方形和圓——用幾何圖形拼出無限創意", cover_image: "🔺" },
    en: { title: "Shape Wizard", summary: "Meet triangles, squares, and circles — create infinite designs with geometric shapes", cover_image: "🔺" },
  },
  {
    id: "seed-math-03", category: "数学思维", age_group: "10-12", interest_tag: null,
    zhCN: { title: "应用题解密", summary: "把文字变成算式——学会用画图、列表、倒推等方法拆解应用题", cover_image: "🧩" },
    zhHK: { title: "應用題解密", summary: "把文字變成算式——學會用畫圖、列表、倒推等方法拆解應用題", cover_image: "🧩" },
    en: { title: "Word Problem Decoder", summary: "Turn words into equations — learn to break down word problems with diagrams, tables, and working backwards", cover_image: "🧩" },
  },
  {
    id: "seed-math-04", category: "数学思维", age_group: "10-12", interest_tag: null,
    zhCN: { title: "速算与估算", summary: "巧算技巧和估算方法——让计算更快，让检查更容易", cover_image: "⚡" },
    zhHK: { title: "速算與估算", summary: "巧算技巧和估算方法——讓計算更快，讓檢查更容易", cover_image: "⚡" },
    en: { title: "Speed and Estimation", summary: "Clever calculation tricks and estimation methods — compute faster, check easier", cover_image: "⚡" },
  },
  {
    id: "seed-math-05", category: "数学思维", age_group: "10-12", interest_tag: null,
    zhCN: { title: "逻辑推理训练", summary: "数独、逻辑谜题、推理游戏——锻炼你的逻辑思维能力", cover_image: "🧠" },
    zhHK: { title: "邏輯推理訓練", summary: "數獨、邏輯謎題、推理遊戲——鍛煉你的邏輯思維能力", cover_image: "🧠" },
    en: { title: "Logic Training", summary: "Sudoku, logic puzzles, deduction games — train your logical thinking skills", cover_image: "🧠" },
  },

  // ═══════ 🎯 学业赋能 · 综合能力 ═══════
  {
    id: "seed-study-01", category: "综合能力", age_group: "6-9", interest_tag: null,
    zhCN: { title: "我的时间我做主", summary: "学会用时间表安排一天的活动——培养时间管理好习惯", cover_image: "⏰" },
    zhHK: { title: "我的時間我做主", summary: "學會用時間表安排一天的活動——培養時間管理好習慣", cover_image: "⏰" },
    en: { title: "My Time, My Plan", summary: "Learn to schedule your day with a timetable — build good time management habits", cover_image: "⏰" },
  },
  {
    id: "seed-study-02", category: "综合能力", age_group: "6-9", interest_tag: null,
    zhCN: { title: "专注力训练营", summary: "通过好玩的注意力游戏，提升听课和做事的专注力", cover_image: "🎯" },
    zhHK: { title: "專注力訓練營", summary: "通過好玩的注意力遊戲，提升聽課和做事的專注力", cover_image: "🎯" },
    en: { title: "Focus Training Camp", summary: "Boost concentration in class and tasks through fun attention games", cover_image: "🎯" },
  },
  {
    id: "seed-study-03", category: "综合能力", age_group: "10-12", interest_tag: null,
    zhCN: { title: "考试不发慌", summary: "考前紧张很正常——学会管理考试焦虑，从容面对测验", cover_image: "😌" },
    zhHK: { title: "考試唔會慌", summary: "考前緊張好正常——學會管理考試焦慮，從容面對測驗", cover_image: "😌" },
    en: { title: "Stay Cool for Exams", summary: "Pre-exam nerves are normal — learn to manage test anxiety and stay confident", cover_image: "😌" },
  },
  {
    id: "seed-study-04", category: "综合能力", age_group: "10-12", interest_tag: null,
    zhCN: { title: "笔记术入门", summary: "康奈尔笔记法、思维导图——学会高效整理和复习课堂知识", cover_image: "📒" },
    zhHK: { title: "筆記術入門", summary: "康奈爾筆記法、思維導圖——學會高效整理和複習課堂知識", cover_image: "📒" },
    en: { title: "Intro to Note-Taking", summary: "Cornell method, mind maps — learn to organise and review class knowledge efficiently", cover_image: "📒" },
  },
  {
    id: "seed-study-05", category: "综合能力", age_group: "10-12", interest_tag: null,
    zhCN: { title: "错题本管理", summary: "把做错的题变成进步的阶梯——建立和管理你的错题本", cover_image: "📊" },
    zhHK: { title: "錯題本管理", summary: "把做錯的題變成進步的階梯——建立和管理你的錯題本", cover_image: "📊" },
    en: { title: "Error Log Mastery", summary: "Turn mistakes into stepping stones — build and manage your error logbook", cover_image: "📊" },
  },
];

// ─── 执行迁移 ───────────────────────────────────────────────────

function seedTopics(): void {
  const db = getDb();

  const row = db.prepare("SELECT COUNT(*) as count FROM topic_catalog").get() as { count: number };
  if (row.count > 0) {
    console.log(`topic_catalog 已有 ${row.count} 条记录，跳过种子数据插入（幂等保护）`);
    return;
  }

  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const insert = db.prepare(`
    INSERT INTO topic_catalog (id, title, summary, cover_image, category, age_group, language, interest_tag, source, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seed', 0, 1, ?, ?)
  `);

  const insertMany = db.transaction((topics: typeof SEED_TOPICS) => {
    const languages = ["zhCN", "zhHK", "en"] as const;
    const langCodes: Record<string, string> = { zhCN: "zh-CN", zhHK: "zh-HK", en: "en" };

    let count = 0;
    for (const t of topics) {
      for (const langKey of languages) {
        const locale = t[langKey];
        insert.run(
          `${t.id}-${langCodes[langKey]}`,
          locale.title,
          locale.summary,
          locale.cover_image,
          t.category,
          t.age_group,
          langCodes[langKey],
          t.interest_tag,
          now,
          now,
        );
        count++;
      }
    }
    return count;
  });

  const inserted = insertMany(SEED_TOPICS);
  console.log(`种子话题导入完成：${inserted} 条记录（${SEED_TOPICS.length} 话题 × 3 种语言）`);
}

seedTopics();
```

- [ ] **Step 2: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 3: 执行种子数据导入**

```bash
npx tsx scripts/seed-topics.ts
```

Expected: 输出 "种子话题导入完成：192 条记录（64 话题 × 3 种语言）"

- [ ] **Step 4: 验证数据正确性**

```bash
node -e "
const {getDb}=require('./lib/db/index');
const db=getDb();
const counts=db.prepare('SELECT language, age_group, COUNT(*) as cnt FROM topic_catalog WHERE source=\"seed\" GROUP BY language, age_group ORDER BY language, age_group').all();
console.table(counts);
"
```

Expected: 每种语言 64 条，按年龄段分布正确。

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-topics.ts
git commit -m "feat(p7): add seed topic migration with 64 topics across 3 languages (192 rows)"
```

---

### Task 8: 孩子端探索页

**Files:**
- Create: `app/explore/page.tsx`
- Create: `components/parent/topic-card.tsx`
- Create: `components/parent/topic-detail.tsx`

**Interfaces:**
- Consumes: `GET /api/topics` (list with filters), `GET /api/topics/[id]/contents` (get active content), `POST /api/topics/[id]/generate` (trigger generation) from Tasks 4-5
- Consumes: `TopicCatalog`, `TopicContent`, `Challenge`, `TopicCategory`, `TopicLanguage` from Task 1

- [ ] **Step 1: 创建 `components/parent/topic-card.tsx`**

```tsx
"use client";

import type { TopicCatalog } from "@/lib/utils/types";
import { useRouter } from "next/navigation";

export function TopicCard({ topic }: { topic: TopicCatalog }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/explore?topic=${topic.id}`)}
      className="bg-surface border border-border rounded-card p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="text-3xl mb-2">{topic.cover_image || "📚"}</div>
      <h3 className="text-body font-bold text-ink mb-1">{topic.title}</h3>
      <p className="text-body-sm text-ink-tertiary line-clamp-2">{topic.summary}</p>
    </button>
  );
}
```

- [ ] **Step 2: 创建 `components/parent/topic-detail.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import type { TopicCatalog, TopicContent, Challenge } from "@/lib/utils/types";

interface Props {
  topic: TopicCatalog;
  onBack: () => void;
  initialLanguage: string;
}

export function TopicDetail({ topic, onBack, initialLanguage }: Props) {
  const [content, setContent] = useState<TopicContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/topics/${topic.id}/contents?age_group=${topic.age_group}&language=${initialLanguage}`
      );
      const data = await res.json();
      if (data.hasContent) {
        setContent(data.content);
      } else {
        setContent(null);
      }
    } catch {
      setError("无法加载内容");
    } finally {
      setLoading(false);
    }
  }, [topic.id, topic.age_group, initialLanguage]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/topics/${topic.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: initialLanguage }),
      });
      const data = await res.json();
      if (data.status === "generating") {
        // Poll for content
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          const check = await fetch(
            `/api/topics/${topic.id}/contents?age_group=${topic.age_group}&language=${initialLanguage}`
          );
          const checkData = await check.json();
          if (checkData.hasContent) {
            setContent(checkData.content);
            setGenerating(false);
            clearInterval(poll);
          } else if (attempts >= 30) {
            // 60 seconds timeout
            setError("内容生成超时，请稍后重试");
            setGenerating(false);
            clearInterval(poll);
          }
        }, 2000);
      }
    } catch {
      setError("生成失败，请稍后重试");
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="text-body-sm text-ink-tertiary hover:text-primary transition-colors"
        >
          ← 返回目录
        </button>
        <div className="bg-surface border border-border rounded-card p-8 text-center">
          <p className="text-ink-tertiary">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-body-sm text-ink-tertiary hover:text-primary transition-colors"
      >
        ← 返回目录
      </button>

      {error && (
        <div className="bg-brand-soft border border-brand rounded-card p-4">
          <p className="text-body-sm text-ink">{error}</p>
        </div>
      )}

      {!content && !generating && (
        <div className="bg-surface border border-border rounded-card p-8 text-center space-y-3">
          <div className="text-4xl">{topic.cover_image || "📚"}</div>
          <h2 className="text-body-lg font-bold">{topic.title}</h2>
          <p className="text-body-sm text-ink-tertiary">{topic.summary}</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm disabled:opacity-40"
          >
            开始探索
          </button>
        </div>
      )}

      {generating && (
        <div className="bg-surface border border-border rounded-card p-8 text-center">
          <div className="text-4xl animate-bounce mb-3">✨</div>
          <p className="text-ink-tertiary">正在准备内容...</p>
        </div>
      )}

      {content && (
        <div className="space-y-4">
          {/* Intro */}
          <section className="bg-surface border border-border rounded-card p-5">
            <div
              className="prose prose-sm max-w-none text-body text-ink"
              dangerouslySetInnerHTML={{ __html: content.intro_text.replace(/\n/g, "<br/>") }}
            />
          </section>

          {/* Challenges */}
          <section className="space-y-3">
            <h3 className="text-body-lg font-bold">🎯 互动挑战</h3>
            {(() => {
              const challenges: Challenge[] = JSON.parse(content.challenges);
              return challenges.map((ch, i) => (
                <div key={i} className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-body-sm font-bold text-primary">挑战 {i + 1}</span>
                    <span className={`text-body-xs px-2 py-0.5 rounded-btn ${ch.difficulty === 1 ? "bg-accent-green/15 text-accent-green" : ch.difficulty === 2 ? "bg-accent-yellow/15 text-ink-secondary" : "bg-primary/15 text-primary"}`}>
                      {"⭐".repeat(ch.difficulty)}
                    </span>
                    <span className="text-body-xs text-ink-tertiary ml-auto">⏱ {ch.estimated_minutes} 分钟</span>
                  </div>
                  <h4 className="text-body font-bold mb-2">{ch.title}</h4>
                  <p className="text-body-sm text-ink-secondary mb-2">{ch.description}</p>
                  {ch.materials.length > 0 && (
                    <p className="text-body-xs text-ink-tertiary mb-2">
                      🧰 材料：{ch.materials.join("、")}
                    </p>
                  )}
                  {ch.hint && (
                    <div className="mt-2 p-2 bg-surface-raised rounded-btn">
                      <p className="text-body-xs text-ink-tertiary">💡 {ch.hint}</p>
                    </div>
                  )}
                </div>
              ));
            })()}
          </section>

          {/* Project cta */}
          {content.project_prompt && (
            <section className="bg-surface border border-border rounded-card p-5 text-center">
              <p className="text-body-sm text-ink-secondary mb-3">{content.project_prompt}</p>
              <button
                onClick={() => {/* TODO: integrate with project funnel in P8 */}}
                className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm"
              >
                🚀 进入项目工坊
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 `app/explore/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopicCard } from "@/components/parent/topic-card";
import { TopicDetail } from "@/components/parent/topic-detail";
import type { TopicCatalog, TopicCategory, TopicLanguage } from "@/lib/utils/types";

const CATEGORY_GROUPS: { label: string; icon: string; categories: TopicCategory[] }[] = [
  { label: "探索创造", icon: "🔬", categories: ["自然科学", "技术编程", "视觉艺术", "音乐表演"] },
  { label: "文化根基", icon: "📚", categories: ["历史长廊", "国学经典", "诗词歌赋", "中医智慧"] },
  { label: "学业赋能", icon: "🎯", categories: ["中文精进", "英文探索", "数学思维", "综合能力"] },
];

const LANGUAGES: { code: TopicLanguage; label: string; flag: string }[] = [
  { code: "zh-CN", label: "简体中文", flag: "🇨🇳" },
  { code: "zh-HK", label: "繁體中文", flag: "🇭🇰" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const topicIdParam = searchParams.get("topic");

  const [topics, setTopics] = useState<TopicCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(0);
  const [activeCategory, setActiveCategory] = useState<TopicCategory | null>(null);
  const [language, setLanguage] = useState<TopicLanguage>("zh-CN");
  const [selectedTopic, setSelectedTopic] = useState<TopicCatalog | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    params.set("language", language);
    params.set("isActive", "true");

    setLoading(true);
    fetch(`/api/topics?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setTopics(d.topics);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeCategory, language]);

  useEffect(() => {
    if (topicIdParam && topics.length > 0) {
      const found = topics.find(t => t.id === topicIdParam);
      if (found) setSelectedTopic(found);
    }
  }, [topicIdParam, topics]);

  if (selectedTopic) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <TopicDetail
          topic={selectedTopic}
          onBack={() => setSelectedTopic(null)}
          initialLanguage={language}
        />
      </div>
    );
  }

  const currentCategories = CATEGORY_GROUPS[activeGroup].categories;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">🔍 探索</h1>
      </div>

      {/* Language switcher */}
      <div className="flex items-center gap-2 mb-4">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => setLanguage(l.code)}
            className={`px-3 py-1.5 rounded-btn text-body-sm transition-colors ${
              language === l.code
                ? "bg-primary text-white"
                : "bg-surface border border-border text-ink-secondary hover:bg-surface-raised"
            }`}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      {/* Category group tabs */}
      <div className="flex gap-0 mb-4 border-b border-border">
        {CATEGORY_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => { setActiveGroup(i); setActiveCategory(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-body-sm border-b-2 transition-colors ${
              activeGroup === i
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-ink-tertiary hover:text-ink"
            }`}
          >
            {g.icon} {g.label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-body-sm transition-colors ${
            activeCategory === null
              ? "bg-primary text-white"
              : "bg-surface border border-border text-ink-secondary hover:bg-surface-raised"
          }`}
        >
          全部
        </button>
        {currentCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-body-sm transition-colors ${
              activeCategory === cat
                ? "bg-primary text-white"
                : "bg-surface border border-border text-ink-secondary hover:bg-surface-raised"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Topic grid */}
      {loading ? (
        <div className="text-center py-12 text-ink-tertiary">加载中...</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 text-ink-tertiary">
          <div className="text-4xl mb-3">📭</div>
          <p>暂无话题，更多内容正在准备中</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {topics.map(topic => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 5: Build 验证**

```bash
npm run build
```

Expected: 无构建错误，所有新页面编译通过。

- [ ] **Step 6: Commit**

```bash
git add app/explore/ components/parent/topic-card.tsx components/parent/topic-detail.tsx
git commit -m "feat(p7): add child explore page with topic grid, detail view, and language switcher"
```

---

### Task 9: 家长端话题管理

**Files:**
- Create: `components/parent/topic-manager.tsx`
- Modify: `app/parent/page.tsx` — 添加 "content" Tab

**Interfaces:**
- Consumes: `GET /api/topics`, `POST /api/topics`, `PUT /api/topics/[id]`, `DELETE /api/topics/[id]` from Task 4
- Consumes: `GET /api/topics/[id]/versions`, `PUT /api/topics/[id]/versions/[versionId]/activate`, `DELETE /api/topics/[id]/versions/[versionId]` from Task 5
- Consumes: `GET /api/topics/suggestions`, `PUT /api/topics/suggestions/[id]` from Task 6
- Consumes: Tab 模式 from app/parent/page.tsx

- [ ] **Step 1: 创建 `components/parent/topic-manager.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { TopicCatalog, TopicContent, TopicSuggestion } from "@/lib/utils/types";

type SubTab = "catalog" | "suggestions";

export function TopicManager() {
  const [subTab, setSubTab] = useState<SubTab>("catalog");
  const [topics, setTopics] = useState<TopicCatalog[]>([]);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTopic, setEditingTopic] = useState<TopicCatalog | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newAgeGroup, setNewAgeGroup] = useState("all");
  const [newLanguage, setNewLanguage] = useState("zh-CN");

  const fetchTopics = async () => {
    const res = await fetch("/api/topics");
    const d = await res.json();
    setTopics(d.topics);
  };

  const fetchSuggestions = async () => {
    const res = await fetch("/api/topics/suggestions");
    const d = await res.json();
    setSuggestions(d.suggestions);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTopics(), fetchSuggestions()]).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newSummary.trim() || !newCategory.trim()) return;
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        summary: newSummary,
        category: newCategory,
        age_group: newAgeGroup,
        language: newLanguage,
      }),
    });
    setNewTitle("");
    setNewSummary("");
    setNewCategory("");
    setShowAddForm(false);
    fetchTopics();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此话题？")) return;
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    fetchTopics();
  };

  const handleSuggestion = async (s: TopicSuggestion, action: "approved" | "rejected") => {
    await fetch(`/api/topics/suggestions/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: action,
        ...(action === "approved"
          ? {
              topic_title: s.candidate_title,
              topic_summary: `与"${s.interest_tag}"相关的知识探索`,
              category: "自然科学",
              age_group: "all",
              language: "zh-CN",
            }
          : {}),
      }),
    });
    fetchSuggestions();
    if (action === "approved") fetchTopics();
  };

  if (loading) {
    return <div className="p-6 text-ink-tertiary">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-0 border-b border-border">
        {([
          { key: "catalog" as SubTab, label: "📂 话题目录", count: topics.length },
          { key: "suggestions" as SubTab, label: "💡 智能推荐", count: suggestions.length },
        ]).map(st => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-body-sm border-b-2 transition-colors ${
              subTab === st.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-ink-tertiary hover:text-ink"
            }`}
          >
            {st.label} ({st.count})
          </button>
        ))}
      </div>

      {/* Catalog tab */}
      {subTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-body-lg font-bold">话题目录</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-primary text-white border-none rounded-btn px-4 py-2 font-semibold text-body-sm"
            >
              {showAddForm ? "取消" : "+ 添加话题"}
            </button>
          </div>

          {showAddForm && (
            <div className="bg-surface border border-border rounded-card p-4 space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="话题标题"
                className="w-full px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
              />
              <input
                type="text"
                value={newSummary}
                onChange={e => setNewSummary(e.target.value)}
                placeholder="一句话简介"
                className="w-full px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
              />
              <div className="flex gap-3">
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
                >
                  <option value="">选择分类</option>
                  <option value="自然科学">自然科学</option>
                  <option value="技术编程">技术编程</option>
                  <option value="视觉艺术">视觉艺术</option>
                  <option value="音乐表演">音乐表演</option>
                  <option value="历史长廊">历史长廊</option>
                  <option value="国学经典">国学经典</option>
                  <option value="诗词歌赋">诗词歌赋</option>
                  <option value="中医智慧">中医智慧</option>
                  <option value="中文精进">中文精进</option>
                  <option value="英文探索">英文探索</option>
                  <option value="数学思维">数学思维</option>
                  <option value="综合能力">综合能力</option>
                </select>
                <select
                  value={newAgeGroup}
                  onChange={e => setNewAgeGroup(e.target.value)}
                  className="w-28 px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
                >
                  <option value="6-9">6-9 岁</option>
                  <option value="10-12">10-12 岁</option>
                  <option value="13-15">13-15 岁</option>
                  <option value="all">全年龄</option>
                </select>
                <select
                  value={newLanguage}
                  onChange={e => setNewLanguage(e.target.value)}
                  className="w-28 px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-HK">繁體中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              <button
                onClick={handleAdd}
                className="bg-primary text-white border-none rounded-btn px-4 py-2 font-semibold text-body-sm"
              >
                确认添加
              </button>
            </div>
          )}

          <div className="space-y-2">
            {topics.map(topic => (
              <div
                key={topic.id}
                className="bg-surface border border-border rounded-card p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span>{topic.cover_image || "📚"}</span>
                    <span className="text-body font-bold">{topic.title}</span>
                    <span className="text-body-xs text-ink-tertiary px-2 py-0.5 bg-surface-raised rounded-full">
                      {topic.age_group}
                    </span>
                    <span className="text-body-xs text-ink-tertiary">{topic.language}</span>
                    <span className="text-body-xs text-ink-tertiary">| {topic.category}</span>
                  </div>
                  <p className="text-body-sm text-ink-tertiary mt-1">{topic.summary}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className={`text-body-xs px-2 py-0.5 rounded-full ${
                    topic.source === "seed" ? "bg-surface-raised text-ink-tertiary" :
                    topic.source === "auto_suggested" ? "bg-accent-purple/15 text-accent-purple" :
                    "bg-accent-green/15 text-accent-green"
                  }`}>
                    {topic.source === "seed" ? "种子" : topic.source === "auto_suggested" ? "推荐" : "手动"}
                  </span>
                  <button
                    onClick={() => handleDelete(topic.id)}
                    className="text-body-xs text-ink-tertiary hover:text-red-500 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions tab */}
      {subTab === "suggestions" && (
        <div className="space-y-4">
          <h3 className="text-body-lg font-bold">智能推荐审核</h3>
          {suggestions.length === 0 ? (
            <p className="text-ink-tertiary text-body-sm">暂无待审核的推荐</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map(s => (
                <div key={s.id} className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-bold">{s.candidate_title}</span>
                      <span className="text-body-xs text-ink-tertiary px-2 py-0.5 bg-surface-raised rounded-full">
                        {s.interest_tag}
                      </span>
                      <span className={`text-body-xs font-bold ${
                        s.viability_score >= 0.7 ? "text-accent-green" :
                        s.viability_score >= 0.5 ? "text-accent-yellow" : "text-red-500"
                      }`}>
                        可行性：{Math.round(s.viability_score * 100)}%
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSuggestion(s, "approved")}
                        className="bg-accent-green text-white border-none rounded-btn px-3 py-1.5 font-semibold text-body-xs"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleSuggestion(s, "rejected")}
                        className="bg-surface-raised border border-border text-ink-secondary rounded-btn px-3 py-1.5 text-body-xs"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                  {s.viability_reason && (
                    <p className="text-body-xs text-ink-tertiary">{s.viability_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 修改 `app/parent/page.tsx`**

a) 在 `import` 区域追加：
```typescript
import { TopicManager } from "@/components/parent/topic-manager";
```

b) 修改 `Tab` 类型：
```typescript
type Tab = "control" | "models" | "projects" | "profile" | "content" | "data" | "logs";
```

c) 在 `tabs` 数组中，`profile` 和 `data` 之间插入：
```typescript
{ key: "content", label: "内容", icon: "📰" },
```

d) 在 JSX tab 内容区域，`profile` 和 `data` 之间插入：
```tsx
{tab === "content" && <TopicManager />}
```

- [ ] **Step 3: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 4: Build 验证**

```bash
npm run build
```

Expected: 无构建错误。

- [ ] **Step 5: Commit**

```bash
git add components/parent/topic-manager.tsx app/parent/page.tsx
git commit -m "feat(p7): add parent topic manager with catalog management and suggestion review"
```

---

### Task 10: 首页导航与最终集成

**Files:**
- Modify: `app/page.tsx` — 添加探索页导航链接
- (no other changes — verification only)

**Interfaces:**
- Consumes: 所有 Tasks 1-9 产物
- Verification: `npm run build` 全量编译通过

- [ ] **Step 1: 修改 `app/page.tsx`**

在导航栏链接中，在"项目"链接之前插入探索页链接：

```tsx
<Link
  href="/explore"
  className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
>
  🔍 探索
</Link>
```

插入位置：`<header>` 内的 `<div className="flex items-center gap-1">` 中，第一个 `<Link>`（🚀 项目）之前。

- [ ] **Step 2: 全量 Build 验证**

```bash
npm run build
```

Expected: 构建成功，无错误，无警告。

- [ ] **Step 3: 功能手动验证清单**

启动开发服务器验证以下路径均可访问：
- `GET /api/topics?language=zh-CN` → 返回种子话题列表
- `GET /api/topics?language=zh-HK` → 返回繁中种子话题
- `GET /api/topics?language=en` → 返回英文种子话题
- `POST /api/topics` → 创建新话题
- `GET /api/topics/suggestions` → 返回空列表
- `GET /api/topics/[id]/contents` → 返回空内容（未生成）
- `/explore` 页面 → 展示话题卡片网格
- `/parent` → "内容" Tab 可见，展示话题目录
- 首页 → "🔍 探索"链接可见

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(p7): add explore link to homepage navigation"
```

---

## 任务依赖图

```
Task 1 (Types & DB)
  └→ Task 2 (DB access layer)
       ├→ Task 3 (Content generation engine)
       ├→ Task 4 (Core API routes)
       ├→ Task 5 (Generate & versions API) ← depends on Task 3
       ├→ Task 6 (Suggestions API)
       └→ Task 7 (Seed migration)
            └→ Task 8 (Explore page) ← depends on Tasks 4, 5
            └→ Task 9 (Parent manager) ← depends on Tasks 4, 5, 6
                 └→ Task 10 (Nav + integration) ← depends on Tasks 8, 9
```

建议执行顺序：1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
