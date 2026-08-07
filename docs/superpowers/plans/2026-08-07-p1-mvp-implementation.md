# Kid-Aider P1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Kid-Aider MVP — a web app where a child types an idea, the system guides them through a 5-layer requirement funnel, and outputs a structured "solution pack" they can take to downstream agents like Claude Code.

**Architecture:** Next.js 14 App Router monolith — React frontend with Server Components, API Routes for backend logic, SQLite via better-sqlite3 for persistence. The guide engine uses a hybrid approach: a hardcoded state machine drives the funnel, while LLM prompts handle open-ended dialogue. SSE streaming for chat responses.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui, Zustand, better-sqlite3, openai SDK, @anthropic-ai/sdk

## Global Constraints

- Next.js 14 App Router (not Pages Router)
- TypeScript strict mode
- Tailwind CSS v3 with shadcn/ui (new-skew)
- better-sqlite3 for SQLite (synchronous API)
- All API Keys encrypted at rest in SQLite (AES-256-GCM via Node crypto)
- SSE streaming for all LLM responses (no polling, no WebSockets)
- Three age groups supported from day one: 6-9, 10-12, 13-15
- UI follows kid-aider_design.md visual spec: --color-primary #4F7CFF, --color-bg #FAF9F6, 18px base font for dialogue, rounded bubbles, minimum 16px text
- Chinese (zh-CN) as primary UI language
- Localhost-only deployment; no auth, no multi-tenancy
- No voice, no project studio, no growth system, no evolution engine

---

## File Structure Map

```
kid-aider/
├── app/
│   ├── layout.tsx                          # Root layout: ThemeProvider + AgeContext + fonts
│   ├── page.tsx                            # Main chat page: ChatView + SidePanel
│   ├── globals.css                         # Tailwind directives + CSS variables
│   ├── settings/
│   │   └── page.tsx                        # Model config page
│   └── api/
│       ├── chat/route.ts                   # POST - SSE chat endpoint
│       ├── compose/route.ts                # POST - generate solution pack
│       └── config/
│           └── models/
│               └── route.ts                # GET/POST/PUT/DELETE model profiles
├── components/
│   ├── chat/
│   │   ├── chat-view.tsx                   # Main chat column container
│   │   ├── message-list.tsx               # Scrollable message container
│   │   ├── bubble-guide.tsx               # System/guide message bubble
│   │   ├── bubble-child.tsx               # Child's message bubble
│   │   ├── streaming-bubble.tsx           # Live-streaming guide bubble
│   │   ├── input-bar.tsx                  # Text input + send button
│   │   └── age-switcher.tsx               # Age group dropdown
│   ├── panels/
│   │   ├── side-panel.tsx                 # Right panel container (collapsible)
│   │   ├── funnel-view.tsx                # 5-layer funnel cards
│   │   ├── funnel-node.tsx                # Single funnel layer card (editable)
│   │   └── solution-preview.tsx           # Solution pack display + confirm
│   └── settings/
│       ├── model-profile-list.tsx         # List of saved model profiles
│       ├── model-profile-form.tsx         # Add/edit profile form
│       └── connectivity-test.tsx          # Test connection button
├── lib/
│   ├── db/
│   │   ├── index.ts                       # SQLite connection + schema init
│   │   ├── sessions.ts                    # Session CRUD
│   │   ├── messages.ts                    # Message CRUD
│   │   ├── requirements.ts                # Requirement node CRUD
│   │   ├── solution-packs.ts             # Solution pack CRUD
│   │   └── model-profiles.ts             # Model profile CRUD
│   ├── engine/
│   │   ├── intent.ts                      # Intent classifier
│   │   ├── funnel-machine.ts              # Funnel state machine (5 layers)
│   │   ├── strategy-picker.ts             # Strategy selector by age + layer
│   │   ├── prompt-builder.ts              # Assembles full LLM prompt
│   │   └── strategy-templates.ts          # Static strategy definitions
│   ├── models/
│   │   ├── router.ts                      # Model selection by role
│   │   ├── openai-adapter.ts              # OpenAI-compatible chat + stream
│   │   └── anthropic-adapter.ts           # Anthropic Messages chat + stream
│   ├── compose/
│   │   └── composer.ts                    # Solution pack assembler
│   ├── prompts/
│   │   └── system-prompt.ts               # Base system prompt builder
│   ├── store/
│   │   └── chat-store.ts                  # Zustand store for chat state
│   └── utils/
│       ├── crypto.ts                      # AES-256-GCM encrypt/decrypt
│       ├── age-config.ts                  # Age-based config parameters
│       └── types.ts                       # Shared TypeScript types
├── data/                                   # SQLite database file lives here (gitignored)
├── DEVELOPMENT.md                          # Progress tracking file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── components.json                         # shadcn/ui config
```

---

### Task 1: Project Scaffold & Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.js`, `components.json`, `postcss.config.js`
- Create: `app/globals.css`, `app/layout.tsx`
- Create: `.gitignore`, `DEVELOPMENT.md`

**Interfaces:**
- Produces: Running dev server at localhost:3000 with Tailwind + shadcn/ui ready

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/yfan/Projects/Products/kid-aider
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd /Users/yfan/Projects/Products/kid-aider
npm install zustand better-sqlite3 openai @anthropic-ai/sdk uuid
npm install -D @types/better-sqlite3 @types/uuid
npx shadcn-ui@latest init
```

Select: TypeScript: yes, style: new-skew, base color: slate, CSS variables: yes, alias: @/components, @/lib/utils.

- [ ] **Step 3: Add shadcn/ui components needed**

```bash
npx shadcn-ui@latest add button input textarea card scroll-area dialog dropdown-menu label separator sheet tooltip badge
```

- [ ] **Step 4: Write Tailwind config with Kid-Aider design tokens**

Write `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#4F7CFF", dark: "#3B5FCC" },
        brand: { DEFAULT: "#FF9F43", soft: "#FFF3E3" },
        accent: { purple: "#8B7CF6", green: "#34C77B", yellow: "#FFD66B" },
        ink: { DEFAULT: "#2B2D42", secondary: "#6B7194", tertiary: "#A3A8C3" },
        surface: { DEFAULT: "#FFFFFF", raised: "#F4F5FB" },
        bubble: { child: "#EAF0FF", guide: "#FFFFFF" },
        border: { DEFAULT: "#E3E6F2" },
      },
      backgroundColor: { page: "#FAF9F6" },
      borderRadius: { card: "20px", bubble: "20px", btn: "14px" },
      fontSize: {
        "body-lg": ["1.125rem", { lineHeight: "1.65" }],
        body: ["1rem", { lineHeight: "1.65" }],
        "body-sm": ["0.875rem", { lineHeight: "1.6" }],
        caption: ["0.75rem", { lineHeight: "1.5" }],
      },
      fontFamily: {
        base: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '-apple-system', 'sans-serif'],
        rounded: ['"Baloo 2"', '"PingFang SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 5: Write CSS variables in globals.css**

Write `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #4F7CFF;
  --color-primary-dark: #3B5FCC;
  --color-brand: #FF9F43;
  --color-brand-soft: #FFF3E3;
  --color-accent-purple: #8B7CF6;
  --color-accent-green: #34C77B;
  --color-accent-yellow: #FFD66B;
  --color-ink: #2B2D42;
  --color-ink-secondary: #6B7194;
  --color-ink-tertiary: #A3A8C3;
  --color-divider: #E8EAF4;
  --color-bg: #FAF9F6;
  --color-surface: #FFFFFF;
  --color-surface-raised: #F4F5FB;
  --color-border: #E3E6F2;
  --color-bubble-child: #EAF0FF;
  --color-bubble-guide: #FFFFFF;
  --color-danger: #FF6B6B;

  --font-family-base: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, sans-serif;

  --shadow-xs: 0 1px 2px rgba(43,45,66,.05);
  --shadow-sm: 0 2px 8px rgba(43,45,66,.06);
  --shadow-md: 0 4px 12px rgba(43,45,66,.08), 0 2px 4px rgba(43,45,66,.04);
  --shadow-lg: 0 8px 24px rgba(43,45,66,.10), 0 2px 6px rgba(43,45,66,.05);
  --shadow-glow: 0 0 24px rgba(255,159,67,.35);
}

body {
  font-family: var(--font-family-base);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 16px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 6: Create .gitignore and data directory**

```bash
echo "node_modules/\n.next/\ndata/\n*.db\n.env\n.env.local" >> .gitignore
mkdir -p data
```

- [ ] **Step 7: Create DEVELOPMENT.md progress tracker**

Write `DEVELOPMENT.md`:

```markdown
# Kid-Aider 开发进度

## 总体进度
P1 ░░░░░░░░░░ 0% | P2 ░░░░░░░░░░ 0% | P3-P6 未开始

## P1 · 核心引导链路
- [ ] Task 1: 项目脚手架与依赖
- [ ] Task 2: 数据库层
- [ ] Task 3: 模型路由与适配器
- [ ] Task 4: 分龄配置与 Prompt 模板
- [ ] Task 5: 引导引擎
- [ ] Task 6: Chat API
- [ ] Task 7: 方案生成 API
- [ ] Task 8: 模型配置 API
- [ ] Task 9: 状态管理与布局
- [ ] Task 10: 对话 UI
- [ ] Task 11: 漏斗面板与方案预览
- [ ] Task 12: 设置页面
- [ ] Task 13: 集成联调
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:3000. You should see the Next.js welcome page with Tailwind applied.

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind, shadcn/ui, and design tokens

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Database Layer

**Files:**
- Create: `lib/utils/types.ts`
- Create: `lib/utils/crypto.ts`
- Create: `lib/db/index.ts`
- Create: `lib/db/sessions.ts`
- Create: `lib/db/messages.ts`
- Create: `lib/db/requirements.ts`
- Create: `lib/db/solution-packs.ts`
- Create: `lib/db/model-profiles.ts`

**Interfaces:**
- Produces:
  - `getDb(): Database` — singleton SQLite connection
  - `createSession(attrs) → Session`, `getSession(id) → Session`, `updateSession(id, attrs)`
  - `createMessage(attrs) → Message`, `getMessages(sessionId) → Message[]`
  - `upsertRequirementNode(attrs) → RequirementNode`, `getRequirementNodes(sessionId) → RequirementNode[]`
  - `createSolutionPack(attrs) → SolutionPack`, `getSolutionPack(id) → SolutionPack`, `getSolutionPacksBySession(sessionId) → SolutionPack[]`
  - `createModelProfile(attrs) → ModelProfile`, `listModelProfiles() → ModelProfile[]`, `updateModelProfile(id, attrs)`, `deleteModelProfile(id)`
  - `encryptApiKey(plain: string): string`, `decryptApiKey(cipher: string): string`

- [ ] **Step 1: Write shared types**

Write `lib/utils/types.ts`:

```typescript
export type AgeGroup = "6-9" | "10-12" | "13-15";
export type SessionStatus = "active" | "funneling" | "composing" | "completed";
export type MessageRole = "child" | "guide" | "system";
export type FunnelLayer = 1 | 2 | 3 | 4 | 5;
export type SolutionPackStatus = "draft" | "confirmed" | "exported";
export type ModelProvider = "openai" | "anthropic" | "custom";
export type ModelRole = "dialogue" | "solution_composing" | "quality_evaluation" | "safety_review";

export interface Session {
  id: string;
  title: string;
  age_group: AgeGroup;
  status: SessionStatus;
  funnel_step: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  strategy_id: string | null;
  created_at: string;
}

export interface RequirementNode {
  id: string;
  session_id: string;
  layer: FunnelLayer;
  label: string;
  content: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SolutionPack {
  id: string;
  session_id: string;
  version: number;
  title: string;
  content: string; // YAML string
  status: SolutionPackStatus;
  created_at: string;
  updated_at: string;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: ModelProvider;
  base_url: string;
  api_key: string; // encrypted at rest
  model: string;
  assigned_roles: ModelRole[];
  params: { temperature: number; max_tokens: number };
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Write crypto utils**

Write `lib/utils/crypto.ts`:

```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = crypto.scryptSync(
  process.env.ENCRYPTION_KEY || "kid-aider-dev-key-change-in-production",
  "kid-aider-salt",
  32
);

export function encryptApiKey(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptApiKey(cipher: string): string {
  const [ivHex, tagHex, dataHex] = cipher.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(Buffer.from(dataHex, "hex"), undefined, "utf8") + decipher.final("utf8");
}
```

- [ ] **Step 3: Write database init with schema**

Write `lib/db/index.ts`:

```typescript
import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(process.cwd(), "data", "kid-aider.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '',
      age_group TEXT NOT NULL DEFAULT '10-12',
      status TEXT NOT NULL DEFAULT 'active',
      funnel_step INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('child','guide','system')),
      content TEXT NOT NULL,
      strategy_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requirement_nodes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      layer INTEGER NOT NULL CHECK(layer BETWEEN 1 AND 5),
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      parent_id TEXT REFERENCES requirement_nodes(id) ON DELETE SET NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS solution_packs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('openai','anthropic','custom')),
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      assigned_roles TEXT NOT NULL DEFAULT '["dialogue"]',
      params TEXT NOT NULL DEFAULT '{"temperature":0.7,"max_tokens":2048}',
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_requirements_session ON requirement_nodes(session_id);
    CREATE INDEX IF NOT EXISTS idx_packs_session ON solution_packs(session_id);
  `);

  return db;
}
```

- [ ] **Step 4: Write sessions CRUD**

Write `lib/db/sessions.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Session, AgeGroup, SessionStatus } from "@/lib/utils/types";

export function createSession(attrs: {
  title?: string;
  age_group?: AgeGroup;
}): Session {
  const db = getDb();
  const now = new Date().toISOString();
  const session: Session = {
    id: uuid(),
    title: attrs.title || "",
    age_group: attrs.age_group || "10-12",
    status: "active",
    funnel_step: 0,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO sessions (id, title, age_group, status, funnel_step, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(session.id, session.title, session.age_group, session.status, session.funnel_step, session.created_at, session.updated_at);
  return session;
}

export function getSession(id: string): Session | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session | undefined;
}

export function updateSession(id: string, attrs: Partial<Pick<Session, "title" | "status" | "funnel_step" | "age_group">>): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function listSessions(limit = 20): Session[] {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?").all(limit) as Session[];
}

export function deleteSession(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}
```

- [ ] **Step 5: Write messages CRUD**

Write `lib/db/messages.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Message, MessageRole } from "@/lib/utils/types";

export function createMessage(attrs: {
  session_id: string;
  role: MessageRole;
  content: string;
  strategy_id?: string | null;
}): Message {
  const db = getDb();
  const message: Message = {
    id: uuid(),
    session_id: attrs.session_id,
    role: attrs.role,
    content: attrs.content,
    strategy_id: attrs.strategy_id || null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, strategy_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(message.id, message.session_id, message.role, message.content, message.strategy_id, message.created_at);
  return message;
}

export function getMessages(sessionId: string): Message[] {
  const db = getDb();
  return db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC").all(sessionId) as Message[];
}

export function getRecentMessages(sessionId: string, limit = 20): Message[] {
  const db = getDb();
  return db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?").all(sessionId, limit).reverse() as Message[];
}
```

- [ ] **Step 6: Write requirement nodes CRUD**

Write `lib/db/requirements.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { RequirementNode, FunnelLayer } from "@/lib/utils/types";

export function upsertRequirementNode(attrs: {
  id?: string;
  session_id: string;
  layer: FunnelLayer;
  label: string;
  content: string;
  parent_id?: string | null;
  sort_order?: number;
}): RequirementNode {
  const db = getDb();
  const now = new Date().toISOString();

  // Upsert: if same session + layer exists, update it
  const existing = db.prepare(
    "SELECT id FROM requirement_nodes WHERE session_id = ? AND layer = ? AND label = ?"
  ).get(attrs.session_id, attrs.layer, attrs.label) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE requirement_nodes SET content = ?, updated_at = ? WHERE id = ?`
    ).run(attrs.content, now, existing.id);
    return db.prepare("SELECT * FROM requirement_nodes WHERE id = ?").get(existing.id) as RequirementNode;
  }

  const node: RequirementNode = {
    id: attrs.id || uuid(),
    session_id: attrs.session_id,
    layer: attrs.layer,
    label: attrs.label,
    content: attrs.content,
    parent_id: attrs.parent_id || null,
    sort_order: attrs.sort_order || 0,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO requirement_nodes (id, session_id, layer, label, content, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(node.id, node.session_id, node.layer, node.label, node.content, node.parent_id, node.sort_order, node.created_at, node.updated_at);
  return node;
}

export function getRequirementNodes(sessionId: string): RequirementNode[] {
  const db = getDb();
  return db.prepare("SELECT * FROM requirement_nodes WHERE session_id = ? ORDER BY layer, sort_order").all(sessionId) as RequirementNode[];
}

export function deleteRequirementNode(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM requirement_nodes WHERE id = ?").run(id);
}
```

- [ ] **Step 7: Write solution packs CRUD**

Write `lib/db/solution-packs.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { SolutionPack, SolutionPackStatus } from "@/lib/utils/types";

export function createSolutionPack(attrs: {
  session_id: string;
  title: string;
  content: string;
}): SolutionPack {
  const db = getDb();
  const now = new Date().toISOString();

  // Get next version for this session
  const last = db.prepare(
    "SELECT MAX(version) as max_v FROM solution_packs WHERE session_id = ?"
  ).get(attrs.session_id) as { max_v: number | null };
  const version = (last?.max_v || 0) + 1;

  const pack: SolutionPack = {
    id: uuid(),
    session_id: attrs.session_id,
    version,
    title: attrs.title,
    content: attrs.content,
    status: "draft",
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO solution_packs (id, session_id, version, title, content, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(pack.id, pack.session_id, pack.version, pack.title, pack.content, pack.status, pack.created_at, pack.updated_at);
  return pack;
}

export function getSolutionPack(id: string): SolutionPack | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM solution_packs WHERE id = ?").get(id) as SolutionPack | undefined;
}

export function getSolutionPacksBySession(sessionId: string): SolutionPack[] {
  const db = getDb();
  return db.prepare("SELECT * FROM solution_packs WHERE session_id = ? ORDER BY version DESC").all(sessionId) as SolutionPack[];
}

export function updateSolutionPackStatus(id: string, status: SolutionPackStatus): void {
  const db = getDb();
  db.prepare("UPDATE solution_packs SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
}
```

- [ ] **Step 8: Write model profiles CRUD**

Write `lib/db/model-profiles.ts`:

```typescript
import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import { decryptApiKey, encryptApiKey } from "@/lib/utils/crypto";
import type { ModelProfile, ModelProvider, ModelRole } from "@/lib/utils/types";

interface CreateAttrs {
  name: string;
  provider: ModelProvider;
  base_url: string;
  api_key: string; // plain text input
  model: string;
  assigned_roles?: ModelRole[];
  params?: { temperature: number; max_tokens: number };
}

export function createModelProfile(attrs: CreateAttrs): ModelProfile {
  const db = getDb();
  const now = new Date().toISOString();
  const profile: ModelProfile = {
    id: uuid(),
    name: attrs.name,
    provider: attrs.provider,
    base_url: attrs.base_url,
    api_key: encryptApiKey(attrs.api_key),
    model: attrs.model,
    assigned_roles: attrs.assigned_roles || ["dialogue"],
    params: attrs.params || { temperature: 0.7, max_tokens: 2048 },
    is_default: false,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO model_profiles (id, name, provider, base_url, api_key, model, assigned_roles, params, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(profile.id, profile.name, profile.provider, profile.base_url, profile.api_key, profile.model, JSON.stringify(profile.assigned_roles), JSON.stringify(profile.params), profile.is_default ? 1 : 0, profile.created_at, profile.updated_at);
  return profile;
}

export function listModelProfiles(): ModelProfile[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM model_profiles ORDER BY created_at DESC").all() as Array<Record<string, unknown>>;
  return rows.map(deserializeProfile);
}

export function getModelProfile(id: string): ModelProfile | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM model_profiles WHERE id = ?").get(id);
  return row ? deserializeProfile(row as Record<string, unknown>) : undefined;
}

export function getDefaultProfile(role?: ModelRole): ModelProfile | undefined {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM model_profiles WHERE is_default = 1").all() as Array<Record<string, unknown>>;
  const profiles = rows.map(deserializeProfile);
  if (!role) return profiles[0];
  return profiles.find(p => p.assigned_roles.includes(role)) || profiles[0];
}

export function updateModelProfile(id: string, attrs: Partial<CreateAttrs & { is_default: boolean }>): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) {
      if (k === "api_key") {
        fields.push("api_key = ?");
        values.push(encryptApiKey(v as string));
      } else if (k === "assigned_roles" || k === "params") {
        fields.push(`${k} = ?`);
        values.push(JSON.stringify(v));
      } else if (k === "is_default") {
        fields.push("is_default = ?");
        values.push(v ? 1 : 0);
      } else {
        fields.push(`${k} = ?`);
        values.push(v);
      }
    }
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE model_profiles SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteModelProfile(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM model_profiles WHERE id = ?").run(id);
}

function deserializeProfile(row: Record<string, unknown>): ModelProfile {
  return {
    ...row,
    assigned_roles: JSON.parse(row.assigned_roles as string),
    params: JSON.parse(row.params as string),
    is_default: Boolean(row.is_default),
  } as ModelProfile;
}
```

- [ ] **Step 9: Verify DB initialization works**

Create a quick test script `scripts/test-db.ts`:

```typescript
import { getDb } from "../lib/db/index";
import { createSession, getSession } from "../lib/db/sessions";
import { createModelProfile, listModelProfiles } from "../lib/db/model-profiles";

const db = getDb();
console.log("DB initialized, tables:", db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());

const s = createSession({ age_group: "10-12" });
console.log("Created session:", s.id);
console.log("Retrieved:", getSession(s.id)?.id);

// Test encrypted storage
const p = createModelProfile({
  name: "Test", provider: "openai", base_url: "https://api.openai.com/v1",
  api_key: "sk-test-key-12345", model: "gpt-4o",
});
console.log("Profile created, api_key stored encrypted:", p.api_key.substring(0, 20) + "...");
console.log("Profile count:", listModelProfiles().length);
```

Run: `npx tsx scripts/test-db.ts`

Expected: tables listed, session created, profile with encrypted key.

- [ ] **Step 10: Commit**

```bash
git add lib/db/ lib/utils/types.ts lib/utils/crypto.ts scripts/
git commit -m "feat: add database layer with SQLite schema and CRUD modules

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Model Router & Adapters

**Files:**
- Create: `lib/models/openai-adapter.ts`
- Create: `lib/models/anthropic-adapter.ts`
- Create: `lib/models/router.ts`

**Interfaces:**
- Consumes: `getDefaultProfile(role)` from `lib/db/model-profiles`, `ModelProfile` type
- Produces:
  - `routeModel(role: ModelRole) → { adapter: Adapter, profile: ModelProfile }`
  - `Adapter.streamChat(opts: StreamChatOpts): AsyncIterable<string>`
  - `Adapter.chat(opts: ChatOpts): Promise<string>`

- [ ] **Step 1: Write OpenAI-compatible adapter**

Write `lib/models/openai-adapter.ts`:

```typescript
import OpenAI from "openai";
import type { ModelProfile } from "@/lib/utils/types";
import { decryptApiKey } from "@/lib/utils/crypto";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StreamChatOpts {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export function createOpenAIAdapter(profile: ModelProfile) {
  const apiKey = decryptApiKey(profile.api_key);
  const client = new OpenAI({ baseURL: profile.base_url, apiKey });

  return {
    async *streamChat(opts: StreamChatOpts): AsyncIterable<string> {
      const stream = await client.chat.completions.create({
        model: profile.model,
        messages: opts.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: opts.temperature ?? profile.params.temperature,
        max_tokens: opts.max_tokens ?? profile.params.max_tokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },

    async chat(opts: StreamChatOpts): Promise<string> {
      const response = await client.chat.completions.create({
        model: profile.model,
        messages: opts.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: opts.temperature ?? profile.params.temperature,
        max_tokens: opts.max_tokens ?? profile.params.max_tokens,
        stream: false,
      });
      return response.choices[0]?.message?.content || "";
    },
  };
}

export type OpenAIAdapter = ReturnType<typeof createOpenAIAdapter>;
```

- [ ] **Step 2: Write Anthropic adapter**

Write `lib/models/anthropic-adapter.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { ModelProfile } from "@/lib/utils/types";
import { decryptApiKey } from "@/lib/utils/crypto";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StreamChatOpts {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export function createAnthropicAdapter(profile: ModelProfile) {
  const apiKey = decryptApiKey(profile.api_key);
  const client = new Anthropic({ baseURL: profile.base_url, apiKey });

  return {
    async *streamChat(opts: StreamChatOpts): AsyncIterable<string> {
      // Separate system message from conversation
      const systemMsg = opts.messages.find(m => m.role === "system");
      const conversation = opts.messages.filter(m => m.role !== "system");

      const stream = client.messages.stream({
        model: profile.model,
        system: systemMsg?.content,
        messages: conversation.map(m => ({
          role: m.role === "assistant" ? "assistant" as const : "user" as const,
          content: m.content,
        })),
        temperature: opts.temperature ?? profile.params.temperature,
        max_tokens: opts.max_tokens ?? profile.params.max_tokens,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    },

    async chat(opts: StreamChatOpts): Promise<string> {
      const systemMsg = opts.messages.find(m => m.role === "system");
      const conversation = opts.messages.filter(m => m.role !== "system");

      const response = await client.messages.create({
        model: profile.model,
        system: systemMsg?.content,
        messages: conversation.map(m => ({
          role: m.role === "assistant" ? "assistant" as const : "user" as const,
          content: m.content,
        })),
        temperature: opts.temperature ?? profile.params.temperature,
        max_tokens: opts.max_tokens ?? profile.params.max_tokens,
      });
      const block = response.content.find(b => b.type === "text");
      return block?.text || "";
    },
  };
}

export type AnthropicAdapter = ReturnType<typeof createAnthropicAdapter>;
```

- [ ] **Step 3: Write model router**

Write `lib/models/router.ts`:

```typescript
import type { ModelRole } from "@/lib/utils/types";
import { getDefaultProfile } from "@/lib/db/model-profiles";
import { createOpenAIAdapter, type OpenAIAdapter } from "./openai-adapter";
import { createAnthropicAdapter, type AnthropicAdapter } from "./anthropic-adapter";

export type Adapter = OpenAIAdapter | AnthropicAdapter;

export interface RoutedModel {
  adapter: Adapter;
  profile: { id: string; name: string; provider: string; model: string };
}

export function routeModel(role?: ModelRole): RoutedModel | null {
  const profile = getDefaultProfile(role);
  if (!profile) return null;

  const adapter =
    profile.provider === "anthropic"
      ? createAnthropicAdapter(profile)
      : createOpenAIAdapter(profile);

  return {
    adapter,
    profile: { id: profile.id, name: profile.name, provider: profile.provider, model: profile.model },
  };
}

export function routeModelById(profileId: string): RoutedModel | null {
  const { getModelProfile } = require("@/lib/db/model-profiles");
  const profile = getModelProfile(profileId);
  if (!profile) return null;

  const adapter =
    profile.provider === "anthropic"
      ? createAnthropicAdapter(profile)
      : createOpenAIAdapter(profile);

  return {
    adapter,
    profile: { id: profile.id, name: profile.name, provider: profile.provider, model: profile.model },
  };
}
```

- [ ] **Step 4: Write a quick smoke test**

Create `scripts/test-model.ts`:

```typescript
import { getDb } from "../lib/db/index";
import { createModelProfile } from "../lib/db/model-profiles";
import { routeModel } from "../lib/models/router";

getDb();

// Create a test profile (you'll need a real API key to fully test streaming)
const p = createModelProfile({
  name: "Test-DeepSeek",
  provider: "openai",
  base_url: "https://api.deepseek.com/v1",
  api_key: process.env.TEST_API_KEY || "sk-xxx",
  model: "deepseek-chat",
  assigned_roles: ["dialogue"],
});

const routed = routeModel("dialogue");
console.log("Routed to:", routed?.profile.name, routed?.profile.model);
console.log("Adapter type:", routed?.adapter.constructor.name || "object");
```

- [ ] **Step 5: Commit**

```bash
git add lib/models/
git commit -m "feat: add model router with OpenAI and Anthropic adapters

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Age Config & Prompt Templates

**Files:**
- Create: `lib/utils/age-config.ts`
- Create: `lib/prompts/system-prompt.ts`
- Create: `lib/engine/strategy-templates.ts`

**Interfaces:**
- Consumes: `AgeGroup` type
- Produces:
  - `getAgeConfig(ageGroup: AgeGroup) → AgeConfig` — fonts, limits, strategy params
  - `buildSystemPrompt(ageGroup: AgeGroup) → string`
  - `STRATEGY_TEMPLATES: Record<string, StrategyTemplate>`

- [ ] **Step 1: Write age configuration**

Write `lib/utils/age-config.ts`:

```typescript
import type { AgeGroup } from "./types";

export interface AgeConfig {
  maxReplyLength: number;       // max chars per system reply
  systemSpeechRate: number;     // chars per response (used for truncation guidance)
  maxQuestionsPerRound: number; // max follow-up questions per turn
  fontSize: string;             // base font size class
  inputMode: "voice-first" | "mixed" | "text-first";
  questionStyle: "choice" | "semi-open" | "open";
  funnelNodeStyle: "picture-cards" | "graphic-nodes" | "structured-doc";
  confirmationMethod: "read-aloud" | "click-confirm" | "rewrite";
  reflectionDepth: number;
}

const AGE_CONFIGS: Record<AgeGroup, AgeConfig> = {
  "6-9": {
    maxReplyLength: 60,
    systemSpeechRate: 3.8,
    maxQuestionsPerRound: 1,
    fontSize: "text-body-lg",
    inputMode: "voice-first",
    questionStyle: "choice",
    funnelNodeStyle: "picture-cards",
    confirmationMethod: "read-aloud",
    reflectionDepth: 1,
  },
  "10-12": {
    maxReplyLength: 120,
    systemSpeechRate: 4.2,
    maxQuestionsPerRound: 2,
    fontSize: "text-body-lg",
    inputMode: "mixed",
    questionStyle: "semi-open",
    funnelNodeStyle: "graphic-nodes",
    confirmationMethod: "click-confirm",
    reflectionDepth: 2,
  },
  "13-15": {
    maxReplyLength: 200,
    systemSpeechRate: 4.5,
    maxQuestionsPerRound: 2,
    fontSize: "text-body",
    inputMode: "text-first",
    questionStyle: "open",
    funnelNodeStyle: "structured-doc",
    confirmationMethod: "rewrite",
    reflectionDepth: 4,
  },
};

export function getAgeConfig(ageGroup: AgeGroup): AgeConfig {
  return AGE_CONFIGS[ageGroup];
}
```

- [ ] **Step 2: Write system prompt builder**

Write `lib/prompts/system-prompt.ts`:

```typescript
import type { AgeGroup } from "@/lib/utils/types";
import { getAgeConfig } from "@/lib/utils/age-config";

export function buildSystemPrompt(ageGroup: AgeGroup, funnelStep: number): string {
  const config = getAgeConfig(ageGroup);

  const basePrompt = `你是 Kid-Aider 的引导者，名叫"小K"。你是一个温暖、有好奇心的大孩子式学习伙伴（不是老师，不是家长，不是百科全书）。

## 你的核心使命
帮孩子把模糊的想法梳理成清晰的需求。你引导、提问、梳理，但不替孩子做决定，不直接给成品答案。

## 产品边界（红线）
- 不直接生成完整代码或应用
- 不替孩子做决策或代劳
- 孩子要答案时，先给思路不给结果
- 孩子说"你帮我做吧"时，回应："我可以帮你把它想清楚，但动手做的那部分留给你——那是最好玩的部分。"

## 当前用户年龄段：${ageGroup}岁
- 单次回复不超过${config.maxReplyLength}字
- 每轮最多${config.maxQuestionsPerRound}个追问
${config.questionStyle === "choice" ? "- 提问时给出2-4个选项，让孩子选择而不是开放回答" : ""}
${config.questionStyle === "semi-open" ? "- 提问时给出半开放式引导，配合填空模板" : ""}
${config.questionStyle === "open" ? "- 使用开放式的苏格拉底式提问，引导孩子自己思考" : ""}

## 对话风格
- 句子短（单句≤20字），口语化，多用语气词
- 温暖、鼓励、无评判，永远不让孩子觉得"我问了个笨问题"
- 会惊讶（"哇，真的吗？"），会好奇（"后来呢后来呢？"），会共情（"这确实有点难"）
- 不假装真人（孩子问"你是真人吗"须诚实回答）
- 不评价孩子本人，只回应行为和作品

${funnelStep > 0 ? `
## 需求澄清漏斗
当前处于漏斗第${funnelStep}层（共5层）：
1. 愿望层 —— 我想做什么？
2. 对象层 —— 给谁用/为了什么？
3. 功能层 —— 它要做哪几件事？（3±2条）
4. 约束层 —— 有什么限制？（时间/材料/能力）
5. 验收层 —— 怎样算做好了？

你正在引导第${funnelStep}层。完成当前层后再推进到下一层，不要跳步。
如果当前层的信息已经足够，帮孩子小结并进入下一层。
每层产出要实时确认："我理解的是……对吗？"
` : `
## 引导策略
当孩子表达一个想法或项目创意时，自然地引入需求澄清漏斗：
1. 愿望层：帮孩子把想法凝聚成一句话目标
2. 对象层：引导孩子想想使用者与场景
3. 功能层：把功能列出来（3±2条）
4. 约束层：讨论时间、材料、能力边界
5. 验收层：让孩子自己定义"怎样算做好了"

如果孩子只是简单提问或闲聊，自然回应即可，不必强行拉入漏斗。
但可以在回答后温柔延伸："你想不想把这个做成一个小项目？"
`}`;

  return basePrompt;
}
```

- [ ] **Step 3: Write strategy templates**

Write `lib/engine/strategy-templates.ts`:

```typescript
export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  example: string;
  applicableFunnelLayers: number[]; // 0 = outside funnel
}

export const STRATEGY_TEMPLATES: Record<string, StrategyTemplate> = {
  "5w1h": {
    id: "5w1h",
    name: "5W1H 澄清",
    description: "谁/什么/何时/何地/为什么/怎么做",
    example: "这个游戏是给谁玩的？",
    applicableFunnelLayers: [0, 1, 2],
  },
  "magic-wand": {
    id: "magic-wand",
    name: "魔法棒提问",
    description: "抛开限制想理想态",
    example: "如果有一根魔法棒，你希望它变成什么样？",
    applicableFunnelLayers: [0, 1],
  },
  "concretize": {
    id: "concretize",
    name: "具象化",
    description: "把抽象变具体",
    example: "你说的'好玩'，是像哪个游戏那样好玩？",
    applicableFunnelLayers: [1, 3, 4],
  },
  "prioritize": {
    id: "prioritize",
    name: "排序选择",
    description: "训练优先级思维",
    example: "这三个功能，你最想先要有哪一个？",
    applicableFunnelLayers: [2, 3],
  },
  "counter-example": {
    id: "counter-example",
    name: "反例检验",
    description: "训练边界思维",
    example: "什么情况出现时，说明它做得不对？",
    applicableFunnelLayers: [4],
  },
  "teach-back": {
    id: "teach-back",
    name: "教回去（费曼技巧）",
    description: "让孩子讲给别人听",
    example: "你能假装我是小同学，给我讲讲你的方案吗？",
    applicableFunnelLayers: [1, 2, 3, 4, 5],
  },
  "chunk-down": {
    id: "chunk-down",
    name: "拆分游戏",
    description: "把大问题切成小块",
    example: "我们先只做'按下按钮会亮'这一小步好不好？",
    applicableFunnelLayers: [2, 3],
  },
  "reflect-compare": {
    id: "reflect-compare",
    name: "对比反思",
    description: "对比前后变化",
    example: "你一开始的想法和现在相比，哪里不一样了？",
    applicableFunnelLayers: [5],
  },
};

export function getStrategiesForLayer(layer: number): StrategyTemplate[] {
  return Object.values(STRATEGY_TEMPLATES).filter(s =>
    s.applicableFunnelLayers.includes(layer)
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/utils/age-config.ts lib/prompts/ lib/engine/strategy-templates.ts
git commit -m "feat: add age-based config, system prompt builder, and strategy templates

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Guide Engine

**Files:**
- Create: `lib/engine/intent.ts`
- Create: `lib/engine/funnel-machine.ts`
- Create: `lib/engine/strategy-picker.ts`
- Create: `lib/engine/prompt-builder.ts`

**Interfaces:**
- Consumes: `Message`, `AgeGroup`, `AgeConfig` types, `getAgeConfig`, `buildSystemPrompt`, `getStrategiesForLayer`, strategy templates
- Produces:
  - `classifyIntent(input: string) → "question" | "task" | "project" | "chat"`
  - `FunnelMachine` class: `getState() → FunnelState`, `advance(input: string) → FunnelTransition`
  - `pickStrategy(ageGroup, funnelLayer) → StrategyTemplate`
  - `buildChatPrompt(session, messages, ageGroup) → ChatMessage[]`

- [ ] **Step 1: Write intent classifier**

Write `lib/engine/intent.ts`:

```typescript
export type Intent = "question" | "task" | "project" | "chat";

const PROJECT_KEYWORDS = [
  "想做", "我要做", "帮我做", "我想弄", "搞一个", "整一个",
  "设计", "开发", "制作", "创造", "搭建", "做一个",
  "app", "游戏", "小程序", "网页", "网站", "机器人",
  "自动", "装置", "diy", "项目",
];

const QUESTION_KEYWORDS = [
  "为什么", "什么是", "怎么", "如何", "是什么", "什么意思",
  "能", "可以吗", "行不行", "对不对", "有没有",
];

const TASK_KEYWORDS = [
  "帮我写", "帮我改", "帮我查", "帮我整理", "帮我总结",
  "作文", "作业", "读后感", "报告", "笔记",
];

export function classifyIntent(input: string): Intent {
  const lower = input.toLowerCase();

  if (PROJECT_KEYWORDS.some(k => lower.includes(k))) return "project";
  if (TASK_KEYWORDS.some(k => lower.includes(k))) return "task";
  if (QUESTION_KEYWORDS.some(k => lower.includes(k))) return "question";

  return "chat";
}
```

- [ ] **Step 2: Write funnel state machine**

Write `lib/engine/funnel-machine.ts`:

```typescript
export type FunnelLayer = 0 | 1 | 2 | 3 | 4 | 5;

export interface FunnelState {
  currentLayer: FunnelLayer;
  layers: Record<number, FunnelLayerData>;
}

export interface FunnelLayerData {
  label: string;
  question: string;
  content: string;
  complete: boolean;
}

const FUNNEL_LAYERS: Array<{ label: string; question: string }> = [
  { label: "愿望", question: "你想做什么？用一句话说说你的想法。" },
  { label: "对象", question: "给谁用/为了什么呢？" },
  { label: "功能", question: "它需要做哪几件事？我们列出3个左右就好。" },
  { label: "约束", question: "有什么限制吗？比如时间、材料、或者你现在会做的事情。" },
  { label: "验收", question: "怎样算做好了？你自己来定义成功的标准。" },
];

export function createFunnelState(): FunnelState {
  return {
    currentLayer: 1,
    layers: Object.fromEntries(
      FUNNEL_LAYERS.map((l, i) => [
        i + 1,
        { label: l.label, question: l.question, content: "", complete: false },
      ])
    ),
  };
}

export function getLayerQuestion(layer: FunnelLayer): string {
  if (layer === 0) return "";
  return FUNNEL_LAYERS[layer - 1].question;
}

export function getLayerLabel(layer: FunnelLayer): string {
  if (layer === 0) return "";
  return FUNNEL_LAYERS[layer - 1].label;
}

export function isFunnelComplete(state: FunnelState): boolean {
  return Object.values(state.layers).every(l => l.complete);
}

export function getMissingLayers(state: FunnelState): number[] {
  return Object.entries(state.layers)
    .filter(([, v]) => !v.complete)
    .map(([k]) => parseInt(k));
}

export interface FunnelTransition {
  action: "stay" | "advance" | "complete";
  currentLayer: FunnelLayer;
  nextQuestion?: string;
  summary?: string;
}

export function evaluateLayerCompletion(
  state: FunnelState,
  childResponse: string
): FunnelTransition {
  const layer = state.currentLayer;
  if (layer === 0) {
    return { action: "advance", currentLayer: 1, nextQuestion: getLayerQuestion(1) };
  }

  // Simple heuristic: if child's response is substantive enough (not just "不知道" or too short),
  // mark current layer complete and advance
  const isSubstantive = childResponse.length > 5 && !/^不知道|^不会|^不懂/.test(childResponse);

  if (isSubstantive) {
    state.layers[layer].content = childResponse;
    state.layers[layer].complete = true;

    if (layer >= 5) {
      return { action: "complete", currentLayer: 5 };
    }

    const nextLayer = (layer + 1) as FunnelLayer;
    state.currentLayer = nextLayer;
    return {
      action: "advance",
      currentLayer: nextLayer,
      nextQuestion: getLayerQuestion(nextLayer),
      summary: `好的，关于「${getLayerLabel(layer)}」我记下了。接下来我们想想「${getLayerLabel(nextLayer)}」。`,
    };
  }

  // Stay on current layer, rephrase
  return {
    action: "stay",
    currentLayer: layer,
    nextQuestion: `没关系的，我们慢慢想。${getLayerQuestion(layer)}`,
  };
}
```

- [ ] **Step 3: Write strategy picker**

Write `lib/engine/strategy-picker.ts`:

```typescript
import type { AgeGroup } from "@/lib/utils/types";
import type { FunnelLayer } from "./funnel-machine";
import { getStrategiesForLayer, type StrategyTemplate } from "./strategy-templates";
import { getAgeConfig } from "@/lib/utils/age-config";

export function pickStrategy(
  ageGroup: AgeGroup,
  funnelLayer: FunnelLayer
): StrategyTemplate {
  const config = getAgeConfig(ageGroup);
  const candidates = getStrategiesForLayer(funnelLayer);

  if (candidates.length === 0) {
    // Fallback to 5W1H
    return (getStrategiesForLayer(0).find(s => s.id === "5w1h") || getStrategiesForLayer(0)[0])!;
  }

  // For choice-oriented ages, prefer concretize and prioritize
  if (config.questionStyle === "choice") {
    const preferred = candidates.find(s => s.id === "prioritize" || s.id === "concretize");
    if (preferred) return preferred;
  }

  // For open-oriented ages, prefer magic-wand and teach-back
  if (config.questionStyle === "open") {
    const preferred = candidates.find(s => s.id === "magic-wand" || s.id === "teach-back");
    if (preferred) return preferred;
  }

  // Default: pick first available
  return candidates[0];
}

export function formatStrategyPrompt(strategy: StrategyTemplate): string {
  return `[引导策略：${strategy.name}]
${strategy.description}
参考示例："${strategy.example}"
请在回应中自然应用这个策略，不要直接说出策略名称。`;
}
```

- [ ] **Step 4: Write prompt builder**

Write `lib/engine/prompt-builder.ts`:

```typescript
import type { AgeGroup } from "@/lib/utils/types";
import type { Message } from "@/lib/utils/types";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";
import { pickStrategy, formatStrategyPrompt } from "./strategy-picker";
import type { FunnelState, FunnelLayer } from "./funnel-machine";
import { getLayerQuestion, getLayerLabel } from "./funnel-machine";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildChatPrompt(opts: {
  ageGroup: AgeGroup;
  funnelStep: number;
  funnelState?: FunnelState;
  recentMessages: Message[];
  currentInput: string;
}): ChatMessage[] {
  const systemPrompt = buildSystemPrompt(opts.ageGroup, opts.funnelStep);
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // Add recent conversation history
  for (const msg of opts.recentMessages) {
    messages.push({
      role: msg.role === "guide" ? "assistant" : "user",
      content: msg.content,
    });
  }

  // Add funnel context if in funnel
  if (opts.funnelState && opts.funnelState.currentLayer > 0) {
    const layer = opts.funnelState.currentLayer as FunnelLayer;
    const strategy = pickStrategy(opts.ageGroup, layer);
    const strategyHint = formatStrategyPrompt(strategy);

    const funnelContext = [
      `--- 当前漏斗状态 ---`,
      `第${layer}层：${getLayerLabel(layer)}`,
      `引导问题：${getLayerQuestion(layer)}`,
      strategyHint,
      ...Object.entries(opts.funnelState.layers)
        .filter(([, v]) => v.complete)
        .map(([k, v]) => `第${k}层「${v.label}」已完成：${v.content}`),
    ].join("\n");

    messages.push({ role: "system", content: funnelContext });
  }

  // Add current input
  messages.push({ role: "user", content: opts.currentInput });

  return messages;
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/engine/intent.ts lib/engine/funnel-machine.ts lib/engine/strategy-picker.ts lib/engine/prompt-builder.ts
git commit -m "feat: add guide engine with intent classifier, funnel state machine, and prompt builder

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Chat API

**Files:**
- Create: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: All DB modules, engine modules, model router, types
- Produces: `POST /api/chat` — SSE streaming response

- [ ] **Step 1: Write chat API route**

Write `app/api/chat/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { createSession, getSession, updateSession } from "@/lib/db/sessions";
import { createMessage, getRecentMessages } from "@/lib/db/messages";
import { upsertRequirementNode, getRequirementNodes } from "@/lib/db/requirements";
import { routeModel } from "@/lib/models/router";
import { classifyIntent } from "@/lib/engine/intent";
import { createFunnelState, evaluateLayerCompletion, getLayerLabel, isFunnelComplete } from "@/lib/engine/funnel-machine";
import { buildChatPrompt } from "@/lib/engine/prompt-builder";
import type { AgeGroup, FunnelLayer } from "@/lib/utils/types";

export async function POST(req: NextRequest) {
  const { message, sessionId, ageGroup } = await req.json() as {
    message: string;
    sessionId?: string;
    ageGroup?: AgeGroup;
  };

  // Get or create session
  let session = sessionId ? getSession(sessionId) : null;
  if (!session) {
    session = createSession({ age_group: ageGroup || "10-12" });
  }

  const ag = (ageGroup || session.age_group) as AgeGroup;

  // Save child message
  createMessage({ session_id: session.id, role: "child", content: message });

  // Classify intent
  const intent = classifyIntent(message);

  // Determine if entering funnel
  let funnelState = session.funnel_step > 0 ? createFunnelState() : undefined;
  if (intent === "project" && session.funnel_step === 0) {
    // Start funnel
    updateSession(session.id, { status: "funneling", funnel_step: 1 });
    funnelState = createFunnelState();
  } else if (session.funnel_step > 0) {
    // Restore funnel state from existing requirement nodes
    funnelState = createFunnelState();
    const nodes = getRequirementNodes(session.id);
    for (const n of nodes) {
      if (funnelState.layers[n.layer]) {
        funnelState.layers[n.layer].content = n.content;
        funnelState.layers[n.layer].complete = true;
      }
    }
    // Set current layer to first incomplete
    const incomplete = Object.entries(funnelState.layers).find(([, v]) => !v.complete);
    if (incomplete) {
      funnelState.currentLayer = parseInt(incomplete[0]) as FunnelLayer;
    } else {
      funnelState.currentLayer = 5 as FunnelLayer;
    }
  }

  // Route model
  const routed = routeModel("dialogue");
  if (!routed) {
    return new Response(
      JSON.stringify({ error: "没有配置模型。请先在设置中添加模型档案。" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build prompt
  const recentMessages = getRecentMessages(session.id, 20);
  const promptMessages = buildChatPrompt({
    ageGroup: ag,
    funnelStep: session.funnel_step,
    funnelState,
    recentMessages,
    currentInput: message,
  });

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
        for await (const chunk of routed.adapter.streamChat({
          messages: promptMessages,
        })) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }

        // Process funnel advancement if in funnel
        if (funnelState && funnelState.currentLayer > 0) {
          const transition = evaluateLayerCompletion(funnelState, fullResponse);

          if (transition.action === "advance") {
            // Save completed layer to requirement node
            const prevLayer = (transition.currentLayer - 1) as FunnelLayer;
            if (prevLayer >= 1 && funnelState.layers[prevLayer]?.complete) {
              upsertRequirementNode({
                session_id: session.id,
                layer: prevLayer,
                label: getLayerLabel(prevLayer),
                content: funnelState.layers[prevLayer].content,
              });
            }
            updateSession(session.id, { funnel_step: transition.currentLayer });
          }

          if (transition.action === "complete") {
            // Save final layer
            const lastLayer = 5 as FunnelLayer;
            if (funnelState.layers[lastLayer]?.complete) {
              upsertRequirementNode({
                session_id: session.id,
                layer: lastLayer,
                label: getLayerLabel(lastLayer),
                content: funnelState.layers[lastLayer].content,
              });
            }
            updateSession(session.id, { status: "composing", funnel_step: 5 });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ funnel_complete: true })}\n\n`));
          }

          if (transition.action === "stay") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ funnel_layer: transition.currentLayer, rephrase: true })}\n\n`));
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
      }

      // Save guide message
      createMessage({
        session_id: session.id,
        role: "guide",
        content: fullResponse,
        strategy_id: funnelState ? `funnel-layer-${funnelState.currentLayer}` : "open-dialogue",
      });

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Session-Id": session.id,
    },
  });
}
```

- [ ] **Step 2: Verify endpoint**

```bash
# Start dev server and test with curl (requires a configured model)
npm run dev
```

Test with curl (after configuring a model in Task 8):

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","ageGroup":"10-12"}'
```

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: add SSE streaming chat API with funnel integration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Solution Composer API

**Files:**
- Create: `lib/compose/composer.ts`
- Create: `app/api/compose/route.ts`

**Interfaces:**
- Consumes: DB modules, model router, types
- Produces:
  - `composeSolutionPack(sessionId, ageGroup) → SolutionPack`
  - `POST /api/compose` — generate solution pack

- [ ] **Step 1: Write composer logic**

Write `lib/compose/composer.ts`:

```typescript
import type { AgeGroup, SolutionPack } from "@/lib/utils/types";
import { getRequirementNodes } from "@/lib/db/requirements";
import { getRecentMessages } from "@/lib/db/messages";
import { createSolutionPack } from "@/lib/db/solution-packs";
import { routeModel } from "@/lib/models/router";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";
import { getLayerLabel } from "@/lib/engine/funnel-machine";

export async function composeSolutionPack(
  sessionId: string,
  ageGroup: AgeGroup
): Promise<SolutionPack | null> {
  const nodes = getRequirementNodes(sessionId);
  if (nodes.length === 0) return null;

  const routed = routeModel("solution_composing") || routeModel("dialogue");
  if (!routed) return null;

  // Build requirements summary
  const requirements = nodes.map(n =>
    `- ${getLayerLabel(n.layer as 1|2|3|4|5)}：${n.content}`
  ).join("\n");

  const composePrompt = `${buildSystemPrompt(ageGroup, 5)}

## 任务：生成方案包
基于孩子确认的需求，生成一份结构化的方案包。

### 孩子的需求
${requirements}

### 请按以下 YAML 格式输出方案包（只输出 YAML，不要其他内容）：

\`\`\`yaml
solution_pack:
  title: 项目名称（有趣、孩子会喜欢的名字）
  child_statement: 保留孩子的原始需求（第一人称，像孩子自己说的那样）
  requirement:
    goal: 一句话目标
    user_scenario: 使用场景
    features: [功能1, 功能2, 功能3]
    constraints: [约束]
    acceptance: 验收标准
  plan:
    steps:
      - title: 第一步名称
        what_to_do: 做什么
        how_hint: 怎么做的小提示（不给答案，给线索）
        difficulty: 1-3
    milestones: [里程碑描述]
  agent_prompt: |
    给下游智能体（如 Claude Code）的完整提示词，用中文写，
    清晰、结构化，包含所有必要信息，可以直接复制使用。
  reflection_questions:
    - 复盘问题1
    - 复盘问题2
\`\`\``;

  try {
    const response = await routed.adapter.chat({
      messages: [
        { role: "system", content: composePrompt },
        { role: "user", content: "请生成方案包。" },
      ],
      temperature: 0.3,
    });

    if (!response) return null;

    // Extract YAML from response (strip markdown code fences if present)
    let yaml = response;
    const match = yaml.match(/```yaml?\n?([\s\S]*?)```/);
    if (match) yaml = match[1].trim();
    yaml = yaml.trim();

    // Extract title
    const titleMatch = yaml.match(/title:\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : "未命名项目";

    const pack = createSolutionPack({
      session_id: sessionId,
      title,
      content: yaml,
    });

    return pack;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write compose API route**

Write `app/api/compose/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/db/sessions";
import { composeSolutionPack } from "@/lib/compose/composer";
import type { AgeGroup } from "@/lib/utils/types";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json() as { sessionId: string };

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  const pack = await composeSolutionPack(sessionId, session.age_group as AgeGroup);

  if (!pack) {
    return NextResponse.json({ error: "生成方案包失败。请确认需求已完整填写。" }, { status: 500 });
  }

  updateSession(sessionId, { status: "completed" });

  return NextResponse.json({ pack });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/compose/ app/api/compose/
git commit -m "feat: add solution composer API for generating structured solution packs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Model Config API

**Files:**
- Create: `app/api/config/models/route.ts`

**Interfaces:**
- Consumes: `lib/db/model-profiles`
- Produces: `GET/POST/PUT/DELETE /api/config/models`

- [ ] **Step 1: Write model config API route**

Write `app/api/config/models/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  listModelProfiles,
  createModelProfile,
  getModelProfile,
  updateModelProfile,
  deleteModelProfile,
} from "@/lib/db/model-profiles";
import { routeModelById } from "@/lib/models/router";
import type { ModelProvider, ModelRole } from "@/lib/utils/types";
import { decryptApiKey } from "@/lib/utils/crypto";

export async function GET() {
  const profiles = listModelProfiles();
  // Return profiles with masked API keys
  const masked = profiles.map(p => ({
    ...p,
    api_key: maskKey(p.api_key),
  }));
  return NextResponse.json({ profiles: masked });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    provider: ModelProvider;
    base_url: string;
    api_key: string;
    model: string;
    assigned_roles?: ModelRole[];
    params?: { temperature: number; max_tokens: number };
  };

  if (!body.name || !body.provider || !body.base_url || !body.api_key || !body.model) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }

  const profile = createModelProfile(body);
  return NextResponse.json({ profile: { ...profile, api_key: maskKey(profile.api_key) } }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { id: string } & Record<string, unknown>;
  const { id, ...attrs } = body;

  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const existing = getModelProfile(id);
  if (!existing) {
    return NextResponse.json({ error: "档案不存在" }, { status: 404 });
  }

  updateModelProfile(id, attrs as Record<string, unknown>);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  deleteModelProfile(id);
  return NextResponse.json({ success: true });
}

// Test connectivity for a specific profile
export async function PATCH(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  const profile = getModelProfile(id);
  if (!profile) {
    return NextResponse.json({ error: "档案不存在" }, { status: 404 });
  }

  const routed = routeModelById(id);
  if (!routed) {
    return NextResponse.json({ error: "无法创建连接" }, { status: 500 });
  }

  try {
    const response = await routed.adapter.chat({
      messages: [{ role: "user", content: "回复'OK'" }],
      max_tokens: 10,
    });
    return NextResponse.json({ connected: true, response: response?.trim() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, error: msg }, { status: 200 });
  }
}

function maskKey(encrypted: string): string {
  // Decrypt and mask: show first 3 and last 4 chars
  try {
    const plain = decryptApiKey(encrypted);
    if (plain.length <= 7) return "****";
    return plain.slice(0, 3) + "****" + plain.slice(-4);
  } catch {
    return "****";
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/config/models/route.ts
git commit -m "feat: add model profile CRUD API with connectivity test

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: State Management & Layout

**Files:**
- Create: `lib/store/chat-store.ts`
- Create: `app/layout.tsx` (update existing)

**Interfaces:**
- Consumes: `AgeGroup`, `Message`, `Session`, `RequirementNode`, `SolutionPack` types
- Produces:
  - `useChatStore` — Zustand store for chat state
  - Root layout with age group provider

- [ ] **Step 1: Write Zustand chat store**

Write `lib/store/chat-store.ts`:

```typescript
import { create } from "zustand";
import type { AgeGroup, Message, RequirementNode, SolutionPack } from "@/lib/utils/types";

interface ChatState {
  // Session
  sessionId: string | null;
  ageGroup: AgeGroup;

  // Messages
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;

  // Funnel
  funnelNodes: RequirementNode[];
  funnelComplete: boolean;

  // Solution pack
  solutionPack: SolutionPack | null;
  solutionStatus: "idle" | "generating" | "ready" | "confirmed";

  // Side panel
  sidePanelOpen: boolean;

  // Actions
  setSessionId: (id: string) => void;
  setAgeGroup: (ag: AgeGroup) => void;
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setStreaming: (v: boolean) => void;
  appendStreamContent: (text: string) => void;
  clearStreamContent: () => void;
  setFunnelNodes: (nodes: RequirementNode[]) => void;
  setFunnelComplete: (v: boolean) => void;
  setSolutionPack: (pack: SolutionPack | null) => void;
  setSolutionStatus: (s: ChatState["solutionStatus"]) => void;
  setSidePanelOpen: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  ageGroup: "10-12" as AgeGroup,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  funnelNodes: [],
  funnelComplete: false,
  solutionPack: null,
  solutionStatus: "idle" as const,
  sidePanelOpen: true,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),
  setAgeGroup: (ag) => set({ ageGroup: ag }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setStreaming: (v) => set({ isStreaming: v }),
  appendStreamContent: (text) => set((s) => ({ streamingContent: s.streamingContent + text })),
  clearStreamContent: () => set({ streamingContent: "" }),
  setFunnelNodes: (nodes) => set({ funnelNodes: nodes }),
  setFunnelComplete: (v) => set({ funnelComplete: v }),
  setSolutionPack: (pack) => set({ solutionPack: pack }),
  setSolutionStatus: (s) => set({ solutionStatus: s }),
  setSidePanelOpen: (v) => set({ sidePanelOpen: v }),
  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Update root layout with age context**

Write `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kid-Aider",
  description: "让孩子想清楚，再让 AI 做出来",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-page min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/store/chat-store.ts app/layout.tsx
git commit -m "feat: add Zustand chat store and root layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Chat UI Components

**Files:**
- Create: `components/chat/chat-view.tsx`
- Create: `components/chat/message-list.tsx`
- Create: `components/chat/bubble-guide.tsx`
- Create: `components/chat/bubble-child.tsx`
- Create: `components/chat/streaming-bubble.tsx`
- Create: `components/chat/input-bar.tsx`
- Create: `components/chat/age-switcher.tsx`

**Interfaces:**
- Consumes: `useChatStore`, `getAgeConfig`, types
- Produces: Complete chat interface components

- [ ] **Step 1: Write BubbleGuide component**

Write `components/chat/bubble-guide.tsx`:

```typescript
"use client";

interface Props {
  content: string;
  strategyId?: string | null;
}

export function BubbleGuide({ content, strategyId }: Props) {
  return (
    <div className="flex gap-3 mb-4">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-white text-sm font-bold shrink-0 mt-1">
        K
      </div>
      {/* Bubble */}
      <div className="bubble-guide bg-bubble-guide border border-border rounded-tl-sm rounded-tr-bubble rounded-br-bubble rounded-bl-bubble px-5 py-4 text-body-lg shadow-sm max-w-[80%]">
        <p className="whitespace-pre-wrap">{content}</p>
        {strategyId && (
          <span className="inline-block mt-2 text-xs text-ink-tertiary bg-surface-raised px-2 py-0.5 rounded-full">
            {strategyId}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write BubbleChild component**

Write `components/chat/bubble-child.tsx`:

```typescript
"use client";

interface Props {
  content: string;
}

export function BubbleChild({ content }: Props) {
  return (
    <div className="flex justify-end mb-4">
      <div className="bubble-child bg-bubble-child rounded-tl-bubble rounded-tr-sm rounded-br-bubble rounded-bl-bubble px-5 py-4 text-body-lg max-w-[80%]">
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write StreamingBubble component**

Write `components/chat/streaming-bubble.tsx`:

```typescript
"use client";

interface Props {
  content: string;
}

export function StreamingBubble({ content }: Props) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-white text-sm font-bold shrink-0 mt-1 animate-pulse">
        K
      </div>
      <div className="bubble-guide bg-bubble-guide border border-border rounded-tl-sm rounded-tr-bubble rounded-br-bubble rounded-bl-bubble px-5 py-4 text-body-lg shadow-sm max-w-[80%]">
        <p className="whitespace-pre-wrap">
          {content}
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom rounded-sm" />
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write MessageList component**

Write `components/chat/message-list.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/store/chat-store";
import { BubbleGuide } from "./bubble-guide";
import { BubbleChild } from "./bubble-child";
import { StreamingBubble } from "./streaming-bubble";

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full text-ink-tertiary">
          <div className="text-6xl mb-4">🌟</div>
          <p className="text-body-lg font-medium">说说你想做什么吧！</p>
          <p className="text-body-sm mt-2">我会帮你把想法变成清晰的方案</p>
        </div>
      )}
      {messages.map((msg) =>
        msg.role === "guide" ? (
          <BubbleGuide key={msg.id} content={msg.content} strategyId={msg.strategy_id} />
        ) : msg.role === "child" ? (
          <BubbleChild key={msg.id} content={msg.content} />
        ) : null
      )}
      {isStreaming && <StreamingBubble content={streamingContent} />}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 5: Write AgeSwitcher component**

Write `components/chat/age-switcher.tsx`:

```typescript
"use client";

import { useChatStore } from "@/lib/store/chat-store";
import type { AgeGroup } from "@/lib/utils/types";

const AGE_OPTIONS: { value: AgeGroup; label: string; emoji: string }[] = [
  { value: "6-9", label: "6–9 岁", emoji: "🌱" },
  { value: "10-12", label: "10–12 岁", emoji: "🌿" },
  { value: "13-15", label: "13–15 岁", emoji: "🌳" },
];

export function AgeSwitcher() {
  const ageGroup = useChatStore((s) => s.ageGroup);
  const setAgeGroup = useChatStore((s) => s.setAgeGroup);

  return (
    <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-1">
      {AGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setAgeGroup(opt.value)}
          className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
            ageGroup === opt.value
              ? "bg-white text-primary shadow-sm"
              : "text-ink-tertiary hover:text-ink-secondary"
          }`}
          title={opt.label}
        >
          {opt.emoji}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Write InputBar component**

Write `components/chat/input-bar.tsx`:

```typescript
"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore } from "@/lib/store/chat-store";
import { AgeSwitcher } from "./age-switcher";
import { getAgeConfig } from "@/lib/utils/age-config";

export function InputBar() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ageGroup = useChatStore((s) => s.ageGroup);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sessionId = useChatStore((s) => s.sessionId);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const appendStreamContent = useChatStore((s) => s.appendStreamContent);
  const clearStreamContent = useChatStore((s) => s.clearStreamContent);
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setFunnelComplete = useChatStore((s) => s.setFunnelComplete);
  const setSolutionStatus = useChatStore((s) => s.setSolutionStatus);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    addMessage({
      id: crypto.randomUUID(),
      session_id: sessionId || "",
      role: "child",
      content: text,
      strategy_id: null,
      created_at: new Date().toISOString(),
    });

    setStreaming(true);
    clearStreamContent();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, ageGroup }),
      });

      const newSessionId = response.headers.get("X-Session-Id");
      if (newSessionId && !sessionId) setSessionId(newSessionId);

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              appendStreamContent(parsed.text);
            }
            if (parsed.funnel_complete) {
              setFunnelComplete(true);
              setSolutionStatus("idle");
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setStreaming(false);
      // Flush streaming content as a guide message
      clearStreamContent();
    }
  }, [input, isStreaming, sessionId, ageGroup]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const config = getAgeConfig(ageGroup);

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "小K正在打字……" : "说说你的想法……"}
            rows={1}
            disabled={isStreaming}
            className={`flex-1 resize-none bg-surface-raised border-2 border-border rounded-btn px-5 py-3.5 ${config.fontSize} min-h-[56px] max-h-[120px] focus:border-primary focus:shadow-[0_0_0_4px_rgba(79,124,255,0.15)] focus:outline-none transition-all placeholder:text-ink-tertiary disabled:opacity-50`}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 bg-primary text-white border-none rounded-btn px-6 py-3.5 font-semibold text-[17px] shadow-[0_4px_12px_rgba(43,45,66,0.10)] hover:bg-primary-dark hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            发送
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <AgeSwitcher />
          <span className="text-caption text-ink-tertiary">
            按 Enter 发送，Shift+Enter 换行
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write ChatView container**

Write `components/chat/chat-view.tsx`:

```typescript
"use client";

import { MessageList } from "./message-list";
import { InputBar } from "./input-bar";

export function ChatView() {
  return (
    <div className="flex flex-col h-full">
      <MessageList />
      <InputBar />
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add components/chat/
git commit -m "feat: add chat UI components - bubbles, streaming, input bar, age switcher

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Funnel Panel & Solution Preview

**Files:**
- Create: `components/panels/side-panel.tsx`
- Create: `components/panels/funnel-view.tsx`
- Create: `components/panels/funnel-node.tsx`
- Create: `components/panels/solution-preview.tsx`
- Create: `app/page.tsx` (update with ChatView + SidePanel layout)

**Interfaces:**
- Consumes: `useChatStore`, types
- Produces: Right side panel with funnel visualization and solution pack preview

- [ ] **Step 1: Write FunnelNode component**

Write `components/panels/funnel-node.tsx`:

```typescript
"use client";

import type { RequirementNode } from "@/lib/utils/types";

const LAYER_LABELS: Record<number, string> = {
  1: "愿望",
  2: "对象",
  3: "功能",
  4: "约束",
  5: "验收",
};

const LAYER_COLORS: Record<number, string> = {
  1: "border-l-primary bg-blue-50/50",
  2: "border-l-accent-purple bg-purple-50/30",
  3: "border-l-brand bg-orange-50/30",
  4: "border-l-accent-yellow bg-yellow-50/30",
  5: "border-l-accent-green bg-green-50/30",
};

interface Props {
  node: RequirementNode;
  isActive: boolean;
}

export function FunnelNode({ node, isActive }: Props) {
  return (
    <div
      className={`card border-l-[5px] rounded-2xl p-4 transition-all ${
        LAYER_COLORS[node.layer] || "border-l-primary"
      } ${isActive ? "ring-2 ring-primary ring-offset-2" : ""} ${
        node.content ? "opacity-100" : "opacity-40"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-bold text-ink-tertiary bg-surface-raised px-2 py-0.5 rounded-full">
          第{node.layer}层
        </span>
        <span className="text-sm font-semibold text-ink">
          {LAYER_LABELS[node.layer] || node.label}
        </span>
        {node.content && (
          <span className="text-xs text-accent-green ml-auto">✓</span>
        )}
      </div>
      {node.content ? (
        <p className="text-body-sm text-ink-secondary">{node.content}</p>
      ) : (
        <p className="text-body-sm text-ink-tertiary italic">等待中……</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write FunnelView component**

Write `components/panels/funnel-view.tsx`:

```typescript
"use client";

import { useChatStore } from "@/lib/store/chat-store";
import { FunnelNode } from "./funnel-node";

export function FunnelView() {
  const funnelNodes = useChatStore((s) => s.funnelNodes);
  const funnelComplete = useChatStore((s) => s.funnelComplete);

  // Always show 5 layers; create placeholder nodes for empty ones
  const displayNodes = Array.from({ length: 5 }, (_, i) => {
    const layer = i + 1;
    const existing = funnelNodes.find((n) => n.layer === layer);
    return existing || {
      id: `placeholder-${layer}`,
      session_id: "",
      layer,
      label: "",
      content: "",
      parent_id: null,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    };
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-ink-secondary uppercase tracking-wider">
          需求树
        </h3>
        {funnelComplete && (
          <span className="badge-achievement inline-flex items-center gap-1 bg-brand-soft text-[#B26A00] rounded-full px-3 py-1 text-xs font-semibold">
            ✨ 完成
          </span>
        )}
      </div>
      <div className="space-y-3">
        {displayNodes.map((node, i) => (
          <FunnelNode
            key={node.id}
            node={node as import("@/lib/utils/types").RequirementNode}
            isActive={!node.content && (i === 0 || displayNodes[i - 1]?.content)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write SolutionPreview component**

Write `components/panels/solution-preview.tsx`:

```typescript
"use client";

import { useChatStore } from "@/lib/store/chat-store";
import { useState } from "react";

export function SolutionPreview() {
  const solutionPack = useChatStore((s) => s.solutionPack);
  const solutionStatus = useChatStore((s) => s.solutionStatus);
  const funnelComplete = useChatStore((s) => s.funnelComplete);
  const setSolutionStatus = useChatStore((s) => s.setSolutionStatus);
  const setSolutionPack = useChatStore((s) => s.setSolutionPack);
  const sessionId = useChatStore((s) => s.sessionId);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!sessionId || isGenerating) return;
    setIsGenerating(true);
    setSolutionStatus("generating");

    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.pack) {
        setSolutionPack(data.pack);
        setSolutionStatus("ready");
      } else {
        setSolutionStatus("idle");
      }
    } catch {
      setSolutionStatus("idle");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = () => {
    if (solutionPack) {
      // Copy agent prompt to clipboard
      const match = solutionPack.content.match(/agent_prompt:\s*\|?\n?([\s\S]*?)(?:\n\S|$)/);
      const prompt = match ? match[1].trim() : solutionPack.content;
      navigator.clipboard.writeText(prompt).catch(console.error);
      setSolutionStatus("confirmed");
    }
  };

  if (!funnelComplete && solutionStatus === "idle") return null;

  return (
    <div className="p-4 border-t border-border">
      <h3 className="text-sm font-bold text-ink-secondary uppercase tracking-wider mb-4">
        方案包
      </h3>

      {solutionStatus === "idle" && funnelComplete && (
        <button
          onClick={handleGenerate}
          className="w-full bg-brand text-white border-none rounded-btn px-5 py-3.5 font-semibold text-[17px] shadow-[0_4px_12px_rgba(43,45,66,0.10)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-all"
        >
          ✨ 生成方案包
        </button>
      )}

      {solutionStatus === "generating" && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-body-sm text-ink-tertiary">正在生成方案包……</p>
        </div>
      )}

      {(solutionStatus === "ready" || solutionStatus === "confirmed") && solutionPack && (
        <div className="space-y-3">
          <div className="bg-surface-raised rounded-2xl p-4">
            <h4 className="font-bold text-body mb-2">{solutionPack.title}</h4>
            <pre className="text-body-sm text-ink-secondary whitespace-pre-wrap font-sans max-h-[300px] overflow-y-auto">
              {solutionPack.content}
            </pre>
          </div>
          {solutionStatus === "ready" && (
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                className="flex-1 bg-primary text-white border-none rounded-btn px-4 py-3 font-semibold text-sm hover:bg-primary-dark transition-colors"
              >
                确认并复制 Agent Prompt
              </button>
            </div>
          )}
          {solutionStatus === "confirmed" && (
            <div className="bg-accent-green/10 text-accent-green rounded-btn px-4 py-3 text-sm font-semibold text-center">
              ✅ 方案包已确认！Prompt 已复制，去 Claude Code 试试吧！
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write SidePanel component**

Write `components/panels/side-panel.tsx`:

```typescript
"use client";

import { useChatStore } from "@/lib/store/chat-store";
import { FunnelView } from "./funnel-view";
import { SolutionPreview } from "./solution-preview";

export function SidePanel() {
  const sidePanelOpen = useChatStore((s) => s.sidePanelOpen);
  const setSidePanelOpen = useChatStore((s) => s.setSidePanelOpen);

  if (!sidePanelOpen) {
    return (
      <button
        onClick={() => setSidePanelOpen(true)}
        className="fixed right-4 top-4 z-50 bg-surface border border-border rounded-xl p-2 shadow-md hover:shadow-lg transition-shadow"
        title="打开需求面板"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3z M3 9h18 M9 3v18" />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-[320px] h-full bg-surface border-l border-border flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-bold text-ink-secondary uppercase tracking-wider">
          项目面板
        </h2>
        <button
          onClick={() => setSidePanelOpen(false)}
          className="text-ink-tertiary hover:text-ink p-1 rounded-lg hover:bg-surface-raised transition-colors"
          title="关闭"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <FunnelView />
      <SolutionPreview />
    </div>
  );
}
```

- [ ] **Step 5: Write main page with layout**

Write `app/page.tsx`:

```typescript
"use client";

import { ChatView } from "@/components/chat/chat-view";
import { SidePanel } from "@/components/panels/side-panel";

export default function Home() {
  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col min-w-0">
        <ChatView />
      </div>
      <SidePanel />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/panels/ app/page.tsx
git commit -m "feat: add funnel panel, solution preview, and main page layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Settings Page

**Files:**
- Create: `app/settings/page.tsx`
- Create: `components/settings/model-profile-list.tsx`
- Create: `components/settings/model-profile-form.tsx`
- Create: `components/settings/connectivity-test.tsx`

**Interfaces:**
- Consumes: model profiles API (`/api/config/models`)
- Produces: Model configuration settings page

- [ ] **Step 1: Write ModelProfileForm**

Write `components/settings/model-profile-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { ModelProvider, ModelRole } from "@/lib/utils/types";

interface Props {
  onSave: (data: {
    name: string; provider: ModelProvider; base_url: string;
    api_key: string; model: string; assigned_roles: ModelRole[];
    params: { temperature: number; max_tokens: number };
  }) => void;
  onCancel: () => void;
  initial?: {
    name?: string; provider?: string; base_url?: string;
    model?: string; assigned_roles?: ModelRole[];
  };
}

export function ModelProfileForm({ onSave, onCancel, initial }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [provider, setProvider] = useState<ModelProvider>((initial?.provider as ModelProvider) || "openai");
  const [baseUrl, setBaseUrl] = useState(initial?.base_url || "");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial?.model || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name, provider, base_url: baseUrl, api_key: apiKey, model,
      assigned_roles: ["dialogue"],
      params: { temperature: 0.7, max_tokens: 2048 },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">档案名称</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="例如：Kimi-主力" required />
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">协议</label>
        <select value={provider} onChange={e => setProvider(e.target.value as ModelProvider)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors">
          <option value="openai">OpenAI 兼容</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">Base URL</label>
        <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="https://api.openai.com/v1" required />
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">API Key</label>
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="sk-……" required />
        <p className="text-caption text-ink-tertiary mt-1">Key 仅存储在本地，加密保存</p>
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">模型名</label>
        <input type="text" value={model} onChange={e => setModel(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="gpt-4o / deepseek-chat / claude-sonnet-5" required />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit"
          className="flex-1 bg-primary text-white border-none rounded-btn px-5 py-3 font-semibold text-body hover:bg-primary-dark transition-colors">
          保存
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 bg-surface text-ink-secondary border-2 border-border rounded-btn px-5 py-3 font-semibold text-body hover:bg-surface-raised transition-colors">
          取消
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Write ConnectivityTest**

Write `components/settings/connectivity-test.tsx`:

```typescript
"use client";

import { useState } from "react";

interface Props {
  profileId: string;
}

export function ConnectivityTest({ profileId }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ connected: boolean; response?: string; error?: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/config/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profileId }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ connected: false, error: "网络错误" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleTest} disabled={testing}
        className="bg-surface text-ink-secondary border-2 border-border rounded-btn px-4 py-2 text-sm font-semibold hover:bg-surface-raised transition-colors disabled:opacity-50">
        {testing ? "测试中……" : "测试连接"}
      </button>
      {result && (
        <span className={`text-sm font-medium ${result.connected ? "text-accent-green" : "text-[#FF6B6B]"}`}>
          {result.connected ? "✅ 连接成功" : `❌ ${result.error || "连接失败"}`}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write ModelProfileList**

Write `components/settings/model-profile-list.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { ModelProfileForm } from "./model-profile-form";
import { ConnectivityTest } from "./connectivity-test";
import type { ModelProfile, ModelProvider, ModelRole } from "@/lib/utils/types";

export function ModelProfileList() {
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [showForm, setShowForm] = useState(false);

  const fetchProfiles = async () => {
    const res = await fetch("/api/config/models");
    const data = await res.json();
    setProfiles(data.profiles || []);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleSave = async (formData: {
    name: string; provider: ModelProvider; base_url: string;
    api_key: string; model: string; assigned_roles: ModelRole[];
    params: { temperature: number; max_tokens: number };
  }) => {
    await fetch("/api/config/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    setShowForm(false);
    fetchProfiles();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/config/models?id=${id}`, { method: "DELETE" });
    fetchProfiles();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">模型档案</h2>
        <button onClick={() => setShowForm(true)}
          className="bg-primary text-white border-none rounded-btn px-4 py-2.5 font-semibold text-sm hover:bg-primary-dark transition-colors">
          + 添加档案
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-card p-6 shadow-sm">
          <ModelProfileForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {profiles.length === 0 && !showForm && (
        <div className="text-center py-12 text-ink-tertiary">
          <p className="text-body-lg">还没有模型档案</p>
          <p className="text-body-sm mt-2">添加一个模型来开始使用 Kid-Aider</p>
        </div>
      )}

      {profiles.map((p) => (
        <div key={p.id} className="bg-surface border border-border rounded-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-body">{p.name}</h3>
              <p className="text-body-sm text-ink-tertiary">{p.provider} · {p.model}</p>
            </div>
            <div className="flex gap-2">
              {p.is_default && (
                <span className="text-xs bg-brand-soft text-[#B26A00] rounded-full px-2.5 py-1 font-semibold">默认</span>
              )}
              <button onClick={() => handleDelete(p.id)}
                className="text-ink-tertiary hover:text-[#FF6B6B] text-sm transition-colors">
                删除
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-body-sm text-ink-tertiary mb-3">
            <span>API Key: {p.api_key}</span>
          </div>
          <ConnectivityTest profileId={p.id} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write settings page**

Write `app/settings/page.tsx`:

```typescript
"use client";

import { ModelProfileList } from "@/components/settings/model-profile-list";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">设置</h1>
      </div>
      <ModelProfileList />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/settings/ components/settings/
git commit -m "feat: add model settings page with CRUD and connectivity testing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Integration & Polish

**Files:**
- Modify: `DEVELOPMENT.md` — mark all P1 tasks complete
- Modify: `lib/models/router.ts` — fix `require()` to proper import

**Interfaces:**
- All modules wired together
- Full user flow verified: type idea → funnel → solution pack → copy prompt

- [ ] **Step 1: Fix dynamic import in model router**

In `lib/models/router.ts`, replace the `require()` with a static import:

```typescript
import type { ModelRole } from "@/lib/utils/types";
import { getDefaultProfile, getModelProfile } from "@/lib/db/model-profiles";
import { createOpenAIAdapter, type OpenAIAdapter } from "./openai-adapter";
import { createAnthropicAdapter, type AnthropicAdapter } from "./anthropic-adapter";

// ... keep existing routeModel and routeModelById, but fix routeModelById:

export function routeModelById(profileId: string): RoutedModel | null {
  const profile = getModelProfile(profileId);
  if (!profile) return null;

  const adapter =
    profile.provider === "anthropic"
      ? createAnthropicAdapter(profile)
      : createOpenAIAdapter(profile);

  return {
    adapter,
    profile: { id: profile.id, name: profile.name, provider: profile.provider, model: profile.model },
  };
}
```

- [ ] **Step 2: Add shell completion to chat flow**

In `components/chat/input-bar.tsx`, after streaming completes and `funnel_complete` is received, trigger the funnel node refresh:

Add to the `handleSend` function, in the SSE parsing loop, after processing `funnel_complete`:

```typescript
if (parsed.funnel_complete) {
  setFunnelComplete(true);
  setSolutionStatus("idle");
  // Fetch requirement nodes to populate funnel view
  fetch(`/api/requirements?sessionId=${sessionId || newSessionId}`)
    .then(r => r.json())
    .then(d => { if (d.nodes) setFunnelNodes(d.nodes); })
    .catch(console.error);
}
```

- [ ] **Step 3: Create requirements fetch API**

Since the funnel panel needs data, add a quick endpoint. Create `app/api/requirements/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRequirementNodes } from "@/lib/db/requirements";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const nodes = getRequirementNodes(sessionId);
  return NextResponse.json({ nodes });
}
```

- [ ] **Step 4: Update DEVELOPMENT.md to mark P1 complete**

```markdown
## P1 · 核心引导链路 ✅ 完成
- [x] Task 1: 项目脚手架与依赖
- [x] Task 2: 数据库层
- [x] Task 3: 模型路由与适配器
- [x] Task 4: 分龄配置与 Prompt 模板
- [x] Task 5: 引导引擎
- [x] Task 6: Chat API
- [x] Task 7: 方案生成 API
- [x] Task 8: 模型配置 API
- [x] Task 9: 状态管理与布局
- [x] Task 10: 对话 UI
- [x] Task 11: 漏斗面板与方案预览
- [x] Task 12: 设置页面
- [x] Task 13: 集成联调
```

- [ ] **Step 5: Full end-to-end test**

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Test flow
# 1. Open http://localhost:3000
# 2. Go to /settings, add a model profile
# 3. Return to /, type "我想做一个记录我每天喝水的小程序"
# 4. Follow the funnel through all 5 layers
# 5. Click "生成方案包"
# 6. Confirm and copy the agent prompt
# Verify: Solution pack YAML is well-structured, agent_prompt is complete
```

- [ ] **Step 6: Verify core flow checklist**

```
[ ] 页面加载，显示欢迎状态
[ ] 输入"你好"，系统正常回复（非漏斗模式）
[ ] 选择不同年龄段，UI 字号和策略切换
[ ] 输入项目想法（如"我想做个小游戏"），漏斗启动
[ ] 右侧面板显示漏斗进度，逐层点亮
[ ] 五层全部完成后，显示"生成方案包"按钮
[ ] 点击生成，等待方案包 YAML 输出
[ ] 方案包包含 title / child_statement / requirement / plan / agent_prompt
[ ] 点击确认，agent_prompt 复制到剪贴板
[ ] 模型设置页 CRUD 正常，连通性测试正常
```

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete P1 MVP - core guidance link working end-to-end

P1 delivers: chat UI with funnel, solution composer, model config,
three age group support, and dual LLM protocol (OpenAI + Anthropic).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

*Implementation plan complete. Proceed to execution.*
