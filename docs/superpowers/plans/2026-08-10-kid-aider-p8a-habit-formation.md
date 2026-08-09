# P8a 习惯养成体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global habit-formation system with user account, daily activity points, 12 badges, 5 rank tiers, and a `/me` dashboard — all local-first, single-user.

**Architecture:** Four new DB tables (user_account, daily_activity, badge_def, badge_unlock) coexist with existing schema. A points engine (`lib/engine/points-engine.ts`) centralizes award logic (daily caps, streak bonuses, duplicate prevention, auto badge-unlock). A rank engine computes tier from total_points. Six new API routes serve the `/me` page. Existing check-in/reflect/generate routes gain side-effect `awardPoints()` calls.

**Tech Stack:** Next.js 14 App Router + TypeScript strict + Tailwind CSS v3 + Zustand v5 + better-sqlite3 (synchronous)

## Global Constraints

- 零新增 npm 依赖 — 积分、排名纯自实现
- 不改变现有 SSE 架构 — 活动记录是同步追加
- TypeScript strict，无 `any`
- 遵循项目 token 设计系统 — 复用 Tailwind 类（surface/ink/primary/border/rounded-card 等）
- P7 内容层不受影响 — side-effect 追加不改核心逻辑
- 单用户本地优先 — user_account 永远一条记录，直到 P8d 引入多用户
- 所有路由文件 must include `export const dynamic = "force-dynamic"`
- DB 访问通过 `import { getDb } from "./index"` 获取实例
- ID 使用 uuid v4，时间戳格式 `new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")`
- 现有 badges 表保留兼容，P8a 新增 badge_def + badge_unlock，不删除不修改旧表

---

### Task 1: Types & DB Tables

**Files:**
- Modify: `lib/utils/types.ts` (append P8a types)
- Modify: `lib/db/index.ts` (append 4 CREATE TABLE statements)

**Interfaces:**
- Produces: `UserAccount`, `DailyActivity`, `BadgeDef`, `BadgeUnlock`, `ActionType`, `BadgeRarity`, `BadgeCategory8`, `RankTier`, `UnlockRule` types
- Produces: 4 new tables + 2 indexes accessible via `getDb()`

- [ ] **Step 1: Append P8a types to `lib/utils/types.ts`**

Add after the last `TopicSuggestion` interface (line 334):

```typescript
// ─── P8a 习惯养成 ───────────────────────────────────────────────

export type ActionType = "login" | "explore_topic" | "complete_challenge" | "task_done" | "check_in" | "reflection";
export type BadgeRarity = "common" | "rare" | "epic" | "legendary";
export type BadgeCategory8 = "explore" | "project" | "streak" | "special";
export type RankTier = "bronze" | "silver" | "gold" | "diamond" | "legendary";

export interface UnlockRule {
  type: "action_count" | "streak_days" | "total_points" | "projects_count" | "reflections_count";
  threshold: number;
  subject?: string;
}

export interface UserAccount {
  id: string;
  display_name: string;
  avatar_emoji: string;
  age_group: string;
  language: string;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  updated_at: string;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  action_type: ActionType;
  action_target: string | null;
  points: number;
  note: string | null;
  created_at: string;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory8;
  rarity: BadgeRarity;
  points_value: number;
  unlock_rule: string; // JSON: UnlockRule
  sort_order: number;
  created_at: string;
}

export interface BadgeUnlock {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
}
```

- [ ] **Step 2: Append 4 CREATE TABLE statements to `lib/db/index.ts`**

Add after the last index in the `db.exec()` block (after `idx_topic_suggestions_status`, before the closing `` ` `` of the template literal on line ~346):

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

    CREATE TABLE IF NOT EXISTS daily_activity (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      action_type     TEXT NOT NULL,
      action_target   TEXT,
      points          INTEGER NOT NULL,
      note            TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date
      ON daily_activity(user_id, created_at);

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

    CREATE TABLE IF NOT EXISTS badge_unlock (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      badge_id        TEXT NOT NULL REFERENCES badge_def(id),
      unlocked_at     TEXT NOT NULL,
      UNIQUE(user_id, badge_id)
    );
    CREATE INDEX IF NOT EXISTS idx_badge_unlock_user ON badge_unlock(user_id);
```

Note: place these BEFORE the final `` ` `` that closes the `db.exec()` template literal — the existing `);` on line 347 closes the `.exec()` call.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/utils/types.ts lib/db/index.ts
git commit -m "feat(p8a): add types and DB tables for habit formation system

- 4 new types: UserAccount, DailyActivity, BadgeDef, BadgeUnlock
- 4 new tables: user_account, daily_activity, badge_def, badge_unlock
- 2 new indexes: idx_daily_activity_user_date, idx_badge_unlock_user"
```

---

### Task 2: DB Module — user_account

**Files:**
- Create: `lib/db/user-account.ts`

**Interfaces:**
- Consumes: `UserAccount` type from `@/lib/utils/types`
- Produces: `getOrCreateAccount(): UserAccount`, `updateAccount(fields): UserAccount`

- [ ] **Step 1: Write the module**

```typescript
import { getDb } from "./index";
import { v4 as uuid } from "uuid";
import type { UserAccount } from "@/lib/utils/types";

const DEFAULT_NAME = "小小探索者";
const DEFAULT_AVATAR = "🧒";
const DEFAULT_AGE = "10-12";
const DEFAULT_LANG = "zh-CN";

export function getOrCreateAccount(): UserAccount {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM user_account LIMIT 1").get() as UserAccount | undefined;
  if (existing) return existing;

  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(`
    INSERT INTO user_account (id, display_name, avatar_emoji, age_group, language, total_points, current_streak, longest_streak, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).run(id, DEFAULT_NAME, DEFAULT_AVATAR, DEFAULT_AGE, DEFAULT_LANG, now, now);

  return db.prepare("SELECT * FROM user_account WHERE id = ?").get(id) as UserAccount;
}

export function updateAccount(fields: {
  display_name?: string;
  avatar_emoji?: string;
  language?: string;
}): UserAccount {
  const db = getDb();
  const account = getOrCreateAccount();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

  const allowedColumns = new Set(["display_name", "avatar_emoji", "language"]);
  const keys = Object.keys(fields).filter(k => allowedColumns.has(k) && fields[k as keyof typeof fields] !== undefined);
  if (keys.length === 0) return account;

  const setClause = keys.map(k => `${k} = ?`).join(", ");
  const values = keys.map(k => (fields as Record<string, unknown>)[k]);
  db.prepare(`UPDATE user_account SET ${setClause}, updated_at = ? WHERE id = ?`)
    .run(...values, now, account.id);

  return db.prepare("SELECT * FROM user_account WHERE id = ?").get(account.id) as UserAccount;
}

/** Directly update points and streak — used by points engine only */
export function updateAccountStats(
  id: string,
  stats: { total_points: number; current_streak: number; longest_streak: number }
): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare(
    "UPDATE user_account SET total_points = ?, current_streak = ?, longest_streak = ?, updated_at = ? WHERE id = ?"
  ).run(stats.total_points, stats.current_streak, stats.longest_streak, now, id);
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/user-account.ts
git commit -m "feat(p8a): add user_account DB module with getOrCreate and update"
```

---

### Task 3: DB Module — daily_activity

**Files:**
- Create: `lib/db/daily-activity.ts`

**Interfaces:**
- Consumes: `DailyActivity`, `ActionType` from `@/lib/utils/types`
- Produces: `createActivity(attrs): DailyActivity`, `countActionToday(userId, actionType): number`, `getTodayActivities(userId): DailyActivity[]`, `getRecentDates(userId, limit): string[]`, `getActionCount(userId, actionType): number`

- [ ] **Step 1: Write the module**

```typescript
import { getDb } from "./index";
import { v4 as uuid } from "uuid";
import type { DailyActivity, ActionType } from "@/lib/utils/types";

export function createActivity(attrs: {
  user_id: string;
  action_type: ActionType;
  action_target?: string;
  points: number;
  note?: string;
}): DailyActivity {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(`
    INSERT INTO daily_activity (id, user_id, action_type, action_target, points, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, attrs.user_id, attrs.action_type, attrs.action_target ?? null, attrs.points, attrs.note ?? null, now);

  return {
    id,
    user_id: attrs.user_id,
    action_type: attrs.action_type,
    action_target: attrs.action_target ?? null,
    points: attrs.points,
    note: attrs.note ?? null,
    created_at: now,
  };
}

export function countActionToday(userId: string, actionType: ActionType): number {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM daily_activity WHERE user_id = ? AND action_type = ? AND date(created_at) = ?"
  ).get(userId, actionType, today) as { cnt: number };
  return row.cnt;
}

export function getTodayActivities(userId: string): DailyActivity[] {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare(
    "SELECT * FROM daily_activity WHERE user_id = ? AND date(created_at) = ? ORDER BY created_at DESC"
  ).all(userId, today) as DailyActivity[];
}

/** Returns the distinct dates (YYYY-MM-DD) a user had any activity, most recent first */
export function getRecentDates(userId: string, limit: number): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT DISTINCT date(created_at) as d FROM daily_activity WHERE user_id = ? ORDER BY d DESC LIMIT ?"
  ).all(userId, limit) as { d: string }[];
  return rows.map(r => r.d);
}

/** Count total activities of a given type (all time) — used for badge checks */
export function getActionCount(userId: string, actionType: ActionType): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM daily_activity WHERE user_id = ? AND action_type = ?"
  ).get(userId, actionType) as { cnt: number };
  return row.cnt;
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/daily-activity.ts
git commit -m "feat(p8a): add daily_activity DB module with create, count, query"
```

---

### Task 4: DB Module — badge_def + badge_unlock

**Files:**
- Create: `lib/db/badge-defs.ts`

**Interfaces:**
- Consumes: `BadgeDef`, `BadgeUnlock` from `@/lib/utils/types`
- Produces: `initBadgeDefs(): void`, `getAllBadgeDefs(): BadgeDef[]`, `getUnlockedBadges(userId): BadgeUnlock[]`, `getUnlockedBadgeIds(userId): Set<string>`, `unlockBadge(userId, badgeId): BadgeUnlock`, `getBadgeDef(id): BadgeDef | undefined`

- [ ] **Step 1: Write the module**

```typescript
import { getDb } from "./index";
import { v4 as uuid } from "uuid";
import type { BadgeDef, BadgeUnlock } from "@/lib/utils/types";

const BADGE_SEEDS: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points_value: number;
  unlock_rule: string;
  sort_order: number;
}> = [
  // — explore —
  { id: "badge-explore-01", name: "初来乍到", description: "首次登录", icon: "👋", category: "explore", rarity: "common", points_value: 10, unlock_rule: JSON.stringify({ type: "action_count", threshold: 1, subject: "login" }), sort_order: 1 },
  { id: "badge-explore-02", name: "好奇宝宝", description: "阅读 10 个话题", icon: "🔍", category: "explore", rarity: "common", points_value: 20, unlock_rule: JSON.stringify({ type: "action_count", threshold: 10, subject: "explore_topic" }), sort_order: 2 },
  { id: "badge-explore-03", name: "博学少年", description: "阅读 50 个话题", icon: "📚", category: "explore", rarity: "rare", points_value: 50, unlock_rule: JSON.stringify({ type: "action_count", threshold: 50, subject: "explore_topic" }), sort_order: 3 },
  { id: "badge-explore-04", name: "实验达人", description: "完成 20 个挑战", icon: "🧪", category: "explore", rarity: "rare", points_value: 50, unlock_rule: JSON.stringify({ type: "action_count", threshold: 20, subject: "complete_challenge" }), sort_order: 4 },
  // — project —
  { id: "badge-project-01", name: "初次启航", description: "创建第一个项目", icon: "🚀", category: "project", rarity: "common", points_value: 15, unlock_rule: JSON.stringify({ type: "projects_count", threshold: 1 }), sort_order: 5 },
  { id: "badge-project-02", name: "建造大师", description: "完成 5 个项目", icon: "🏗️", category: "project", rarity: "rare", points_value: 60, unlock_rule: JSON.stringify({ type: "projects_count", threshold: 5 }), sort_order: 6 },
  { id: "badge-project-03", name: "任务克星", description: "完成 50 个任务", icon: "⚡", category: "project", rarity: "epic", points_value: 100, unlock_rule: JSON.stringify({ type: "action_count", threshold: 50, subject: "task_done" }), sort_order: 7 },
  { id: "badge-project-04", name: "反思者", description: "写 10 条复盘", icon: "📝", category: "project", rarity: "rare", points_value: 40, unlock_rule: JSON.stringify({ type: "reflections_count", threshold: 10 }), sort_order: 8 },
  // — streak —
  { id: "badge-streak-01", name: "三日之约", description: "连续 3 天", icon: "🔥", category: "streak", rarity: "common", points_value: 10, unlock_rule: JSON.stringify({ type: "streak_days", threshold: 3 }), sort_order: 9 },
  { id: "badge-streak-02", name: "七日行者", description: "连续 7 天", icon: "💪", category: "streak", rarity: "rare", points_value: 40, unlock_rule: JSON.stringify({ type: "streak_days", threshold: 7 }), sort_order: 10 },
  { id: "badge-streak-03", name: "月之守护", description: "连续 30 天", icon: "🌙", category: "streak", rarity: "epic", points_value: 150, unlock_rule: JSON.stringify({ type: "streak_days", threshold: 30 }), sort_order: 11 },
  { id: "badge-streak-04", name: "百日传奇", description: "连续 100 天", icon: "👑", category: "streak", rarity: "legendary", points_value: 500, unlock_rule: JSON.stringify({ type: "streak_days", threshold: 100 }), sort_order: 12 },
];

/** Idempotent: seeds badge definitions. Safe to call on every app start. */
export function initBadgeDefs(): void {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as cnt FROM badge_def").get() as { cnt: number };
  if (count.cnt > 0) return;

  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const stmt = db.prepare(`
    INSERT INTO badge_def (id, name, description, icon, category, rarity, points_value, unlock_rule, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const b of BADGE_SEEDS) {
    stmt.run(b.id, b.name, b.description, b.icon, b.category, b.rarity, b.points_value, b.unlock_rule, b.sort_order, now);
  }
}

export function getAllBadgeDefs(): BadgeDef[] {
  const db = getDb();
  return db.prepare("SELECT * FROM badge_def ORDER BY sort_order ASC").all() as BadgeDef[];
}

export function getBadgeDef(id: string): BadgeDef | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM badge_def WHERE id = ?").get(id) as BadgeDef | undefined;
}

export function getUnlockedBadges(userId: string): BadgeUnlock[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM badge_unlock WHERE user_id = ? ORDER BY unlocked_at DESC"
  ).all(userId) as BadgeUnlock[];
}

export function getUnlockedBadgeIds(userId: string): Set<string> {
  const db = getDb();
  const rows = db.prepare(
    "SELECT badge_id FROM badge_unlock WHERE user_id = ?"
  ).all(userId) as { badge_id: string }[];
  return new Set(rows.map(r => r.badge_id));
}

export function unlockBadge(userId: string, badgeId: string): BadgeUnlock {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(
    "INSERT OR IGNORE INTO badge_unlock (id, user_id, badge_id, unlocked_at) VALUES (?, ?, ?, ?)"
  ).run(id, userId, badgeId, now);
  return { id, user_id: userId, badge_id: badgeId, unlocked_at: now };
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/badge-defs.ts
git commit -m "feat(p8a): add badge_def and badge_unlock DB modules with 12 seed badges"
```

---

### Task 5: Points Engine

**Files:**
- Create: `lib/engine/points-engine.ts`

**Interfaces:**
- Consumes: `UserAccount`, `DailyActivity`, `ActionType`, `BadgeDef`, `BadgeUnlock`, `UnlockRule` from `@/lib/utils/types`
- Consumes: `getOrCreateAccount()`, `updateAccountStats()` from `@/lib/db/user-account`
- Consumes: `createActivity()`, `countActionToday()`, `getRecentDates()` from `@/lib/db/daily-activity`
- Consumes: `getAllBadgeDefs()`, `getUnlockedBadgeIds()`, `unlockBadge()`, `getBadgeDef()` from `@/lib/db/badge-defs`
- Consumes: `getActionCount()` from `@/lib/db/daily-activity` (same module, different import)
- Consumes: `getDb` from `@/lib/db/index` (for projects_count and reflections_count queries)
- Produces: `awardPoints(userId, actionType, target?): AwardResult`

```typescript
export interface AwardResult {
  points_awarded: number;
  streak_bonus: boolean;
  new_streak: number;
  new_badges: { id: string; name: string; icon: string; points: number }[];
}
```

- [ ] **Step 1: Write the DAILY_CAPS and POINTS_RULES constants**

```typescript
import { getOrCreateAccount, updateAccountStats } from "@/lib/db/user-account";
import { createActivity, countActionToday, getRecentDates, getActionCount } from "@/lib/db/daily-activity";
import { getAllBadgeDefs, getUnlockedBadgeIds, unlockBadge, getBadgeDef } from "@/lib/db/badge-defs";
import { getDb } from "@/lib/db/index";
import type { ActionType, UnlockRule } from "@/lib/utils/types";

const DAILY_CAPS: Record<ActionType, number> = {
  login: 1,
  explore_topic: 3,
  complete_challenge: 5,
  task_done: 99,
  check_in: 3,
  reflection: 2,
};

const POINTS_RULES: Record<ActionType, { base: number; streakEligible: boolean }> = {
  login: { base: 5, streakEligible: false },
  explore_topic: { base: 10, streakEligible: false },
  complete_challenge: { base: 20, streakEligible: false },
  task_done: { base: 10, streakEligible: false },
  check_in: { base: 15, streakEligible: true },
  reflection: { base: 25, streakEligible: true },
};
```

- [ ] **Step 2: Write the computeStreak function**

```typescript
function computeStreak(userId: string): { current: number; longest: number } {
  const recentDates = getRecentDates(userId, 100);
  if (recentDates.length === 0) return { current: 0, longest: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Is the most recent activity today or yesterday?
  const latest = recentDates[0];
  let current = 0;

  if (latest === today || latest === yesterday) {
    // Count consecutive days backwards
    current = 1;
    const startDate = latest === today ? today : yesterday;
    const checkDate = new Date(startDate);
    for (const d of recentDates.slice(latest === today ? 0 : 0)) {
      // We iterate through recentDates which are sorted DESC
      // Already handled index 0; for i > 0, check if d is exactly one day before
    }
    // Re-count by walking backwards from startDate
    current = 0;
    const cursor = new Date(startDate);
    const dateSet = new Set(recentDates);
    while (dateSet.has(cursor.toISOString().slice(0, 10))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // Longest: scan all dates
  let longest = 0;
  let run = 0;
  const sorted = [...recentDates].sort(); // ascending
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { run = 1; }
    else {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
      if (Math.abs(diffDays - 1) < 0.01) { run++; }
      else { run = 1; }
    }
    if (run > longest) longest = run;
  }

  return { current, longest };
}
```

- [ ] **Step 3: Write the checkBadges function**

```typescript
function checkBadges(userId: string): { id: string; name: string; icon: string; points: number }[] {
  const allDefs = getAllBadgeDefs();
  const unlockedIds = getUnlockedBadgeIds(userId);
  const newBadges: { id: string; name: string; icon: string; points: number }[] = [];

  for (const def of allDefs) {
    if (unlockedIds.has(def.id)) continue;

    const rule: UnlockRule = JSON.parse(def.unlock_rule);
    let satisfied = false;

    switch (rule.type) {
      case "action_count": {
        const cnt = getActionCount(userId, rule.subject as ActionType);
        satisfied = cnt >= rule.threshold;
        break;
      }
      case "streak_days": {
        const { longest } = computeStreak(userId);
        satisfied = longest >= rule.threshold;
        break;
      }
      case "total_points": {
        const account = getOrCreateAccount();
        satisfied = account.total_points >= rule.threshold;
        break;
      }
      case "projects_count": {
        const db = getDb();
        const row = db.prepare("SELECT COUNT(*) as cnt FROM projects").get() as { cnt: number };
        satisfied = row.cnt >= rule.threshold;
        break;
      }
      case "reflections_count": {
        const db = getDb();
        const row = db.prepare("SELECT COUNT(*) as cnt FROM reflections").get() as { cnt: number };
        satisfied = row.cnt >= rule.threshold;
        break;
      }
    }

    if (satisfied) {
      unlockBadge(userId, def.id);
      newBadges.push({ id: def.id, name: def.name, icon: def.icon, points: def.points_value });
    }
  }

  return newBadges;
}
```

- [ ] **Step 4: Write the awardPoints export function**

```typescript
export interface AwardResult {
  points_awarded: number;
  streak_bonus: boolean;
  new_streak: number;
  new_badges: { id: string; name: string; icon: string; points: number }[];
}

export function awardPoints(userId: string, actionType: ActionType, actionTarget?: string): AwardResult {
  // 1. Check daily cap
  const todayCount = countActionToday(userId, actionType);
  if (todayCount >= DAILY_CAPS[actionType]) {
    return { points_awarded: 0, streak_bonus: false, new_streak: 0, new_badges: [] };
  }

  // 2. Compute streak
  const { current, longest } = computeStreak(userId);
  const rule = POINTS_RULES[actionType];
  let points = rule.base;
  let streakBonus = false;

  if (rule.streakEligible && current >= 7) {
    points = Math.round(points * 1.5);
    streakBonus = true;
  }

  // 3. Persist activity
  createActivity({
    user_id: userId,
    action_type: actionType,
    action_target: actionTarget,
    points,
    note: streakBonus ? `连击加成 ×1.5 (连击${current}天)` : null,
  });

  // 4. Update account stats
  const account = getOrCreateAccount();
  const newTotal = account.total_points + points;
  const newLongest = Math.max(account.longest_streak, current);
  const newStreak = current; // already computed from recentDates + today's activity

  updateAccountStats(account.id, {
    total_points: newTotal,
    current_streak: newStreak,
    longest_streak: newLongest,
  });

  // 5. Check badges
  const newBadges = checkBadges(userId);

  // 6. Award badge points
  let badgePoints = 0;
  for (const b of newBadges) {
    badgePoints += b.points;
  }
  if (badgePoints > 0) {
    updateAccountStats(account.id, {
      total_points: newTotal + badgePoints,
      current_streak: newStreak,
      longest_streak: newLongest,
    });
  }

  return {
    points_awarded: points + badgePoints,
    streak_bonus: streakBonus,
    new_streak: newStreak,
    new_badges: newBadges,
  };
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/engine/points-engine.ts
git commit -m "feat(p8a): add points engine with caps, streaks, badge auto-unlock"
```

---

### Task 6: Rank Engine

**Files:**
- Create: `lib/engine/rank-engine.ts`

**Interfaces:**
- Consumes: `RankTier` from `@/lib/utils/types`
- Consumes: `UserAccount.total_points`
- Produces: `getRank(totalPoints: number): { tier: RankTier; title: string; tierIcon: string; percentileText: string; pointsToNext: number | null }`

- [ ] **Step 1: Write the module**

```typescript
import type { RankTier } from "@/lib/utils/types";

interface RankInfo {
  tier: RankTier;
  title: string;
  tierIcon: string;
  percentileText: string;
  minPoints: number;
}

const RANKS: RankInfo[] = [
  { tier: "bronze",   title: "探索新手", tierIcon: "🥉", percentileText: "你超过了 30% 的探索者", minPoints: 0 },
  { tier: "silver",   title: "知识学徒", tierIcon: "🥈", percentileText: "你超过了 55% 的探索者", minPoints: 101 },
  { tier: "gold",     title: "智慧达人", tierIcon: "🥇", percentileText: "你超过了 80% 的探索者", minPoints: 501 },
  { tier: "diamond",  title: "博学大师", tierIcon: "💎", percentileText: "你超过了 95% 的探索者", minPoints: 2001 },
  { tier: "legendary",title: "传奇探索家", tierIcon: "👑", percentileText: "你在所有探索者中名列前茅", minPoints: 5001 },
];

export function getRank(totalPoints: number): {
  tier: RankTier;
  title: string;
  tierIcon: string;
  percentileText: string;
  pointsToNext: number | null;
} {
  let current = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (totalPoints >= RANKS[i].minPoints) {
      current = RANKS[i];
      break;
    }
  }

  const idx = RANKS.indexOf(current);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  const pointsToNext = next ? next.minPoints - totalPoints : null;

  return {
    tier: current.tier,
    title: current.title,
    tierIcon: current.tierIcon,
    percentileText: current.percentileText,
    pointsToNext,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/engine/rank-engine.ts
git commit -m "feat(p8a): add rank engine with 5 tiers and mock percentile text"
```

---

### Task 7: API Routes — /api/user/account

**Files:**
- Create: `app/api/user/account/route.ts`

**Interfaces:**
- Consumes: `getOrCreateAccount()`, `updateAccount()` from `@/lib/db/user-account`
- Produces: `GET /api/user/account` → `{ account: UserAccount }`, `PUT /api/user/account` → `{ account: UserAccount }`

- [ ] **Step 1: Write the route file**

```typescript
import { getOrCreateAccount, updateAccount } from "@/lib/db/user-account";
import { initBadgeDefs } from "@/lib/db/badge-defs";

export const dynamic = "force-dynamic";

export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  return Response.json({ account });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { display_name, avatar_emoji, language } = body as {
    display_name?: string;
    avatar_emoji?: string;
    language?: string;
  };

  const account = updateAccount({
    display_name,
    avatar_emoji,
    language,
  });

  return Response.json({ account });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/user/account/route.ts
git commit -m "feat(p8a): add GET/PUT /api/user/account with auto-create"
```

---

### Task 8: API Routes — /api/user/activity + /api/user/stats

**Files:**
- Create: `app/api/user/activity/route.ts`
- Create: `app/api/user/stats/route.ts`

**Interfaces:**
- Consumes: `awardPoints()` from `@/lib/engine/points-engine`
- Consumes: `getTodayActivities()` from `@/lib/db/daily-activity`
- Consumes: `getOrCreateAccount()` from `@/lib/db/user-account`
- Consumes: `getUnlockedBadges()` from `@/lib/db/badge-defs`
- Consumes: `getRank()` from `@/lib/engine/rank-engine`
- Consumes: `getDb` from `@/lib/db/index` (for topic/project counts)
- Produces: `GET /api/user/activity` → `{ today_points, streak, activities[] }`, `POST /api/user/activity` → `AwardResult`, `GET /api/user/stats` → stats object

- [ ] **Step 1: Write `app/api/user/activity/route.ts`**

```typescript
import { getOrCreateAccount } from "@/lib/db/user-account";
import { getTodayActivities } from "@/lib/db/daily-activity";
import { awardPoints } from "@/lib/engine/points-engine";
import { initBadgeDefs } from "@/lib/db/badge-defs";
import type { ActionType } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const activities = getTodayActivities(account.id);
  const todayPoints = activities.reduce((sum, a) => sum + a.points, 0);

  return Response.json({
    today_points: todayPoints,
    streak: { current: account.current_streak, longest: account.longest_streak },
    activities,
  });
}

export async function POST(req: Request) {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const body = await req.json().catch(() => ({}));
  const { action_type, action_target } = body as {
    action_type?: ActionType;
    action_target?: string;
  };

  if (!action_type) {
    return Response.json({ error: "action_type is required" }, { status: 400 });
  }

  const VALID_TYPES = new Set<string>(["login", "explore_topic", "complete_challenge", "task_done", "check_in", "reflection"]);
  if (!VALID_TYPES.has(action_type)) {
    return Response.json({ error: `invalid action_type: ${action_type}` }, { status: 400 });
  }

  const result = awardPoints(account.id, action_type, action_target);
  const updated = getOrCreateAccount();

  return Response.json({
    ...result,
    current_streak: updated.current_streak,
    total_points: updated.total_points,
  });
}
```

- [ ] **Step 2: Write `app/api/user/stats/route.ts`**

```typescript
import { getOrCreateAccount } from "@/lib/db/user-account";
import { getUnlockedBadges } from "@/lib/db/badge-defs";
import { getRank } from "@/lib/engine/rank-engine";
import { getDb } from "@/lib/db/index";
import { initBadgeDefs } from "@/lib/db/badge-defs";

export const dynamic = "force-dynamic";

export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const unlocked = getUnlockedBadges(account.id);
  const rank = getRank(account.total_points);
  const db = getDb();

  const totalTopics = (db.prepare("SELECT COUNT(*) as cnt FROM topic_catalog WHERE is_active = 1").get() as { cnt: number }).cnt;
  const totalChallenges = (db.prepare("SELECT COUNT(*) as cnt FROM daily_activity WHERE user_id = ? AND action_type = 'complete_challenge'").get(account.id) as { cnt: number }).cnt;
  const totalProjects = (db.prepare("SELECT COUNT(*) as cnt FROM projects").get() as { cnt: number }).cnt;

  return Response.json({
    total_points: account.total_points,
    current_streak: account.current_streak,
    longest_streak: account.longest_streak,
    rank_tier: rank.tier,
    rank_title: rank.title,
    rank_icon: rank.tierIcon,
    rank_text: rank.percentileText,
    next_tier: rank.pointsToNext,
    badges_count: unlocked.length,
    total_topics: totalTopics,
    total_challenges: totalChallenges,
    total_projects: totalProjects,
  });
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/user/activity/route.ts app/api/user/stats/route.ts
git commit -m "feat(p8a): add /api/user/activity and /api/user/stats routes"
```

---

### Task 9: API Routes — /api/user/badges + /api/leaderboard

**Files:**
- Create: `app/api/user/badges/route.ts`
- Create: `app/api/leaderboard/route.ts`

**Interfaces:**
- Consumes: `getAllBadgeDefs()`, `getUnlockedBadges()`, `getUnlockedBadgeIds()` from `@/lib/db/badge-defs`
- Consumes: `getOrCreateAccount()` from `@/lib/db/user-account`
- Consumes: `computeStreak` logic (inline via `getRecentDates`) and `checkBadges` equivalent — delegate to `awardPoints` with a no-op action or call check logic directly
- Consumes: `getRank()` from `@/lib/engine/rank-engine`
- Produces: `GET /api/user/badges` → `{ unlocked[], all[] }`, `POST /api/user/badges/check` → `{ new_badges[] }`, `GET /api/leaderboard` → leaderboard object

- [ ] **Step 1: Write `app/api/user/badges/route.ts`**

For `POST /check`, we need to import `checkBadges` from the points engine. Make it a standalone export first — but the spec says the checkBadges logic is in points-engine.ts. We'll import the `getAllBadgeDefs`, `getUnlockedBadgeIds`, `unlockBadge`, `getBadgeDef` from badge-defs and the streak/project counting logic inline. Actually, the cleanest approach: expose `checkBadges` from points-engine.ts by adding `export` to the function.

Wait — Task 5 defined `checkBadges` as a local function. We need to export it. Let me update the Task 5 spec to export `checkBadges`.

**Correction to Task 5 Step 3:** Change `function checkBadges` to `export function checkBadges`.

Now for this route:

```typescript
import { getOrCreateAccount } from "@/lib/db/user-account";
import { getAllBadgeDefs, getUnlockedBadges, initBadgeDefs } from "@/lib/db/badge-defs";
import { checkBadges } from "@/lib/engine/points-engine";
import type { BadgeDef, BadgeUnlock } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const all = getAllBadgeDefs();
  const unlocked = getUnlockedBadges(account.id);
  const unlockedIds = new Set(unlocked.map(u => u.badge_id));

  // Merge badge defs with unlock status
  const merged = all.map(def => ({
    ...def,
    unlocked: unlockedIds.has(def.id),
    unlocked_at: unlocked.find(u => u.badge_id === def.id)?.unlocked_at ?? null,
  }));

  return Response.json({ badges: merged });
}

export async function POST() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const newBadges = checkBadges(account.id);

  // Award badge bonus points for newly unlocked badges
  if (newBadges.length > 0) {
    const { awardPoints } = await import("@/lib/engine/points-engine");
    // Points already included in badge value — add via direct activity creation
    const { createActivity } = await import("@/lib/db/daily-activity");
    const { updateAccountStats } = await import("@/lib/db/user-account");
    let bonusPoints = 0;
    for (const b of newBadges) {
      bonusPoints += b.points;
      createActivity({
        user_id: account.id,
        action_type: "login", // placeholder — badge awards don't have their own type
        points: 0,
        note: `🏅 解锁徽章: ${b.name}`,
      });
    }
    const updated = getOrCreateAccount();
    updateAccountStats(account.id, {
      total_points: updated.total_points + bonusPoints,
      current_streak: updated.current_streak,
      longest_streak: updated.longest_streak,
    });
  }

  return Response.json({ new_badges: newBadges });
}
```

Wait, this is getting complex. The `POST /api/user/badges/check` should manually trigger badge detection. `awardPoints` already calls `checkBadges`, so for a manual check, we can just call `checkBadges` directly and handle the bonus points. But `checkBadges` in Task 5 already calls `unlockBadge` and awards points. Let me simplify — the POST /check is a manual re-check that returns any newly unlocked badges. It doesn't need to re-award points since `awardPoints` already did that.

Actually, re-reading the spec: the `POST /api/user/badges/check` is for manual trigger. The `checkBadges` function from Task 5 already unlocks and returns new badges. The point bonuses were already awarded during the `awardPoints` call. So POST /check just runs `checkBadges` again and returns anything new. Keep it simple:

```typescript
import { getOrCreateAccount } from "@/lib/db/user-account";
import { getAllBadgeDefs, getUnlockedBadges, initBadgeDefs } from "@/lib/db/badge-defs";
import { checkBadges } from "@/lib/engine/points-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const allDefs = getAllBadgeDefs();
  const unlocked = getUnlockedBadges(account.id);
  const unlockedIds = new Set(unlocked.map(u => u.badge_id));

  const badges = allDefs.map(def => ({
    id: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    category: def.category,
    rarity: def.rarity,
    points_value: def.points_value,
    unlock_rule: def.unlock_rule,
    unlocked: unlockedIds.has(def.id),
    unlocked_at: unlocked.find(u => u.badge_id === def.id)?.unlocked_at ?? null,
  }));

  return Response.json({ badges });
}

export async function POST() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const newBadges = checkBadges(account.id);
  return Response.json({ new_badges: newBadges });
}
```

- [ ] **Step 2: Write `app/api/leaderboard/route.ts`**

```typescript
import { getOrCreateAccount } from "@/lib/db/user-account";
import { getUnlockedBadges } from "@/lib/db/badge-defs";
import { getRank } from "@/lib/engine/rank-engine";
import { initBadgeDefs } from "@/lib/db/badge-defs";

export const dynamic = "force-dynamic";

export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const rank = getRank(account.total_points);
  const unlocked = getUnlockedBadges(account.id);

  return Response.json({
    mode: "local" as const,
    rank_tier: rank.tier,
    rank_title: rank.title,
    rank_icon: rank.tierIcon,
    rank_text: rank.percentileText,
    total_points: account.total_points,
    badges_count: unlocked.length,
    next_tier: rank.pointsToNext ? {
      tier: rank.tier === "bronze" ? "silver" :
            rank.tier === "silver" ? "gold" :
            rank.tier === "gold" ? "diamond" : "legendary",
      points_needed: rank.pointsToNext,
    } : null,
  });
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/user/badges/route.ts app/api/leaderboard/route.ts
git commit -m "feat(p8a): add /api/user/badges and /api/leaderboard routes"
```

---

### Task 10: /me Page + 4 Components

**Files:**
- Create: `app/me/page.tsx`
- Create: `components/me/user-card.tsx`
- Create: `components/me/daily-summary.tsx`
- Create: `components/me/badge-collection.tsx`
- Create: `components/me/rank-card.tsx`

**Interfaces:**
- Consumes: `GET /api/user/account`, `GET /api/user/activity`, `GET /api/user/stats`, `GET /api/user/badges`
- Components receive data via props — page fetches, components render

- [ ] **Step 1: Write `components/me/user-card.tsx`**

```typescript
"use client";

import { useState } from "react";

interface UserCardProps {
  displayName: string;
  avatarEmoji: string;
  rankIcon: string;
  rankTitle: string;
  rankTier: string;
  currentStreak: number;
  totalPoints: number;
  pointsToNext: number | null;
}

export function UserCard({
  displayName,
  avatarEmoji,
  rankIcon,
  rankTitle,
  rankTier,
  currentStreak,
  totalPoints,
  pointsToNext,
}: UserCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);

  const handleSave = async () => {
    await fetch("/api/user/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: name }),
    });
    setEditing(false);
  };

  // Compute progress percentage within current tier
  const tierThresholds: Record<string, number> = {
    bronze: 100,
    silver: 500,
    gold: 2000,
    diamond: 5000,
    legendary: 5001,
  };
  const prevThresholds: Record<string, number> = {
    bronze: 0,
    silver: 101,
    gold: 501,
    diamond: 2001,
    legendary: 5001,
  };
  const tierMax = tierThresholds[rankTier] ?? 100;
  const tierMin = prevThresholds[rankTier] ?? 0;
  const progressPct = rankTier === "legendary" ? 100 : Math.min(100, Math.round(((totalPoints - tierMin) / (tierMax - tierMin)) * 100));

  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-5xl">{avatarEmoji}</div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-border rounded-btn text-body bg-surface-raised"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="bg-primary text-white border-none rounded-btn px-3 py-1.5 text-body-sm font-semibold"
              >
                保存
              </button>
              <button
                onClick={() => { setName(displayName); setEditing(false); }}
                className="text-ink-tertiary text-body-sm"
              >
                取消
              </button>
            </div>
          ) : (
            <h2
              className="text-body-lg font-bold cursor-pointer hover:text-primary transition-colors"
              onClick={() => setEditing(true)}
              title="点击编辑名称"
            >
              {name} ✏️
            </h2>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl">{rankIcon}</span>
            <span className="text-body-sm text-ink-secondary">{rankTitle}</span>
            <span className="text-body-xs text-ink-tertiary px-2 py-0.5 bg-surface-raised rounded-full">
              {rankTier}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-body-2xl font-bold text-primary">{totalPoints}</div>
          <div className="text-body-xs text-ink-tertiary">总积分</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-body-xs text-ink-tertiary mb-1">
          <span>段位进度</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {pointsToNext !== null && (
          <p className="text-body-xs text-ink-tertiary mt-1">
            距离下一段位还差 {pointsToNext} 分
          </p>
        )}
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2 text-body-sm">
        <span>🔥</span>
        <span className="text-ink-secondary">连续打卡</span>
        <span className="font-bold text-primary">{currentStreak}</span>
        <span className="text-ink-secondary">天</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/me/daily-summary.tsx`**

```typescript
"use client";

interface Activity {
  id: string;
  action_type: string;
  action_target: string | null;
  points: number;
  note: string | null;
  created_at: string;
}

interface DailySummaryProps {
  todayPoints: number;
  streak: { current: number; longest: number };
  activities: Activity[];
}

const ACTION_LABELS: Record<string, { icon: string; label: string }> = {
  login: { icon: "👋", label: "每日登录" },
  explore_topic: { icon: "🔍", label: "探索话题" },
  complete_challenge: { icon: "🎯", label: "完成挑战" },
  task_done: { icon: "✅", label: "完成任务" },
  check_in: { icon: "📋", label: "项目打卡" },
  reflection: { icon: "📝", label: "复盘反思" },
};

export function DailySummary({ todayPoints, streak, activities }: DailySummaryProps) {
  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-body-lg font-bold">📊 今日动态</h3>
        <div className="text-right">
          <span className="text-body-2xl font-bold text-primary">{todayPoints}</span>
          <span className="text-body-xs text-ink-tertiary ml-1">分</span>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="text-ink-tertiary text-body-sm py-4 text-center">
          今天还没有活动记录，去探索或完成项目吧！
        </p>
      ) : (
        <div className="space-y-2">
          {activities.map(a => {
            const meta = ACTION_LABELS[a.action_type] ?? { icon: "📌", label: a.action_type };
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-lg">{meta.icon}</span>
                <span className="flex-1 text-body-sm text-ink-secondary">{meta.label}</span>
                <span className="text-body-sm font-bold text-accent-green">+{a.points}</span>
                {a.note && (
                  <span className="text-body-xs text-ink-tertiary">({a.note})</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `components/me/badge-collection.tsx`**

```typescript
"use client";

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points_value: number;
  unlock_rule: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

interface BadgeCollectionProps {
  badges: BadgeItem[];
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-surface-raised border-border",
  rare: "bg-accent-blue/10 border-accent-blue/30",
  epic: "bg-accent-purple/10 border-accent-purple/30",
  legendary: "bg-accent-yellow/10 border-accent-yellow/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  explore: "🔍 探索",
  project: "🚀 项目",
  streak: "🔥 连击",
  special: "✨ 特殊",
};

export function BadgeCollection({ badges }: BadgeCollectionProps) {
  const categories = [...new Set(badges.map(b => b.category))];

  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <h3 className="text-body-lg font-bold">🏅 徽章收集</h3>

      {categories.map(cat => {
        const catBadges = badges.filter(b => b.category === cat);
        const unlockedCount = catBadges.filter(b => b.unlocked).length;
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-body-sm font-bold text-ink-secondary">
                {CATEGORY_LABELS[cat] ?? cat}
              </h4>
              <span className="text-body-xs text-ink-tertiary">
                {unlockedCount}/{catBadges.length}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {catBadges.map(b => (
                <div
                  key={b.id}
                  className={`relative flex flex-col items-center p-3 rounded-card border transition-all ${
                    b.unlocked
                      ? `${RARITY_COLORS[b.rarity] ?? RARITY_COLORS.common}`
                      : "bg-surface-raised border-border opacity-50 grayscale"
                  }`}
                  title={b.unlocked ? `${b.name}: ${b.description}` : `${b.description} (未解锁)`}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-body-xs mt-1 text-center leading-tight">{b.name}</span>
                  {!b.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg">🔒</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Write `components/me/rank-card.tsx`**

```typescript
"use client";

interface RankCardProps {
  rankIcon: string;
  rankTitle: string;
  rankTier: string;
  rankText: string;
  totalPoints: number;
  badgesCount: number;
  nextTier: { tier: string; points_needed: number } | null;
}

export function RankCard({ rankIcon, rankTitle, rankTier, rankText, totalPoints, badgesCount, nextTier }: RankCardProps) {
  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <h3 className="text-body-lg font-bold">🏆 段位排名</h3>

      <div className="text-center py-4">
        <div className="text-5xl mb-2">{rankIcon}</div>
        <div className="text-body-xl font-bold">{rankTitle}</div>
        <div className="text-body-xs text-ink-tertiary uppercase">{rankTier}</div>
      </div>

      <p className="text-body-sm text-ink-secondary text-center bg-surface-raised rounded-btn py-2 px-4">
        {rankText}
      </p>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-surface-raised rounded-btn p-3">
          <div className="text-body-xl font-bold text-primary">{totalPoints}</div>
          <div className="text-body-xs text-ink-tertiary">总积分</div>
        </div>
        <div className="bg-surface-raised rounded-btn p-3">
          <div className="text-body-xl font-bold text-accent-purple">{badgesCount}</div>
          <div className="text-body-xs text-ink-tertiary">徽章数</div>
        </div>
      </div>

      {nextTier && (
        <p className="text-body-sm text-ink-tertiary text-center">
          距离 {nextTier.tier} 还差 {nextTier.points_needed} 分
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write `app/me/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { UserCard } from "@/components/me/user-card";
import { DailySummary } from "@/components/me/daily-summary";
import { BadgeCollection } from "@/components/me/badge-collection";
import { RankCard } from "@/components/me/rank-card";
import Link from "next/link";

export default function MePage() {
  const [data, setData] = useState<{
    account: { display_name: string; avatar_emoji: string; total_points: number; current_streak: number };
    activity: { today_points: number; streak: { current: number; longest: number }; activities: unknown[] };
    stats: { rank_tier: string; rank_title: string; rank_icon: string; rank_text: string; next_tier: number | null; badges_count: number; total_points: number };
    badges: { badges: unknown[] };
    leaderboard: { next_tier: { tier: string; points_needed: number } | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const [accRes, actRes, statsRes, badgesRes, lbRes] = await Promise.all([
        fetch("/api/user/account"),
        fetch("/api/user/activity"),
        fetch("/api/user/stats"),
        fetch("/api/user/badges"),
        fetch("/api/leaderboard"),
      ]);
      const [account, activity, stats, badges, leaderboard] = await Promise.all([
        accRes.json(),
        actRes.json(),
        statsRes.json(),
        badgesRes.json(),
        lbRes.json(),
      ]);
      setData({ account, activity, stats, badges, leaderboard });
      setLoading(false);
    }
    fetchAll();
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="text-ink-tertiary">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-ink-tertiary hover:text-primary transition-colors">
            ← 返回
          </Link>
          <h1 className="text-body-lg font-bold text-ink">我的</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <UserCard
          displayName={data.account.display_name}
          avatarEmoji={data.account.avatar_emoji}
          rankIcon={data.stats.rank_icon}
          rankTitle={data.stats.rank_title}
          rankTier={data.stats.rank_tier}
          currentStreak={data.account.current_streak}
          totalPoints={data.stats.total_points}
          pointsToNext={data.stats.next_tier}
        />
        <DailySummary
          todayPoints={data.activity.today_points}
          streak={data.activity.streak}
          activities={data.activity.activities as Array<{
            id: string;
            action_type: string;
            action_target: string | null;
            points: number;
            note: string | null;
            created_at: string;
          }>}
        />
        <BadgeCollection badges={data.badges.badges as Array<{
          id: string;
          name: string;
          description: string;
          icon: string;
          category: string;
          rarity: string;
          points_value: number;
          unlock_rule: string;
          unlocked: boolean;
          unlocked_at: string | null;
        }>} />
        <RankCard
          rankIcon={data.stats.rank_icon}
          rankTitle={data.stats.rank_title}
          rankTier={data.stats.rank_tier}
          rankText={data.stats.rank_text}
          totalPoints={data.stats.total_points}
          badgesCount={data.stats.badges_count}
          nextTier={data.leaderboard.next_tier}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add app/me/page.tsx components/me/user-card.tsx components/me/daily-summary.tsx components/me/badge-collection.tsx components/me/rank-card.tsx
git commit -m "feat(p8a): add /me page with UserCard, DailySummary, BadgeCollection, RankCard"
```

---

### Task 11: Integration — Modify Existing Routes + Components

**Files:**
- Modify: `app/page.tsx` (add 👤 我的 nav link)
- Modify: `app/api/projects/[id]/check-in/route.ts` (add awardPoints call)
- Modify: `app/api/projects/[id]/reflect/route.ts` (add awardPoints call)
- Modify: `app/api/topics/[id]/generate/route.ts` (add awardPoints call)
- Modify: `components/parent/topic-detail.tsx` (POST activity on challenge completion)
- Modify: `components/chat/bubble-guide.tsx` (badge congratulations support)

**Interfaces:**
- Consumes: `awardPoints()` from `@/lib/engine/points-engine`
- Consumes: `getOrCreateAccount()` from `@/lib/db/user-account` (to get userId)
- Modifies: 6 files, integration hooks

- [ ] **Step 1: Add 👤 我的 nav link to `app/page.tsx`**

Insert before the 🔍 探索 Link (line 17-22):

```tsx
          <Link
            href="/me"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            👤 我的
          </Link>
```

- [ ] **Step 2: Modify check-in route to award points**

In `app/api/projects/[id]/check-in/route.ts`, add after the existing `recordEvent(...)` call (after line 29 in the POST handler, before `const streak = getStreak(...)`):

```typescript
  // P8a: award habit points
  const { awardPoints } = await import("@/lib/engine/points-engine");
  const { getOrCreateAccount } = await import("@/lib/db/user-account");
  const account = getOrCreateAccount();
  awardPoints(account.id, "check_in", params.id);
```

Wait — these are synchronous imports, not dynamic. In Next.js API routes with `better-sqlite3`, everything is synchronous. Just import at the top:

Actually, the check-in route already has a specific import pattern. Let me add the imports at the top and call inline.

Add these imports to the existing import block:
```typescript
import { awardPoints } from "@/lib/engine/points-engine";
import { getOrCreateAccount } from "@/lib/db/user-account";
```

Add after the `recordEvent(...)` call (after line with `recordEvent("execution", ...)`):
```typescript
  // P8a: award habit points for check-in
  const account = getOrCreateAccount();
  awardPoints(account.id, "check_in", params.id);
```

- [ ] **Step 3: Modify reflect route to award points**

In `app/api/projects/[id]/reflect/route.ts`, add these imports:
```typescript
import { awardPoints } from "@/lib/engine/points-engine";
import { getOrCreateAccount } from "@/lib/db/user-account";
```

Add after the existing `recordEvent(...)` call (after `recordEvent("reflection", ...)` block):
```typescript
  // P8a: award habit points for reflection
  const account = getOrCreateAccount();
  awardPoints(account.id, "reflection", params.id);
```

- [ ] **Step 4: Modify generate route to award points**

In `app/api/topics/[id]/generate/route.ts`, add these imports:
```typescript
import { awardPoints } from "@/lib/engine/points-engine";
import { getOrCreateAccount } from "@/lib/db/user-account";
```

The generate route is fire-and-forget. Award points inside the `.then()` callback where content is confirmed generated, NOT in the synchronous path:

In the `.then()` callback (after `console.log(...)`), add:
```typescript
        // P8a: award habit points for exploring a topic
        try {
          const account = getOrCreateAccount();
          awardPoints(account.id, "explore_topic", params.id);
        } catch (err) {
          console.error("[generate] failed to award points:", err);
        }
```

- [ ] **Step 5: Add challenge completion tracking to topic-detail**

In `components/parent/topic-detail.tsx`, find the challenge completion handling. The current code shows challenges but has no completion button. Add a "完成挑战" button per challenge.

Find the challenge rendering section (around line 183). Modify the challenge map to include a completion button:

```tsx
              return challenges.map((ch, i) => (
                <div key={i} className="bg-surface-raised border border-border rounded-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm font-bold text-primary">挑战 {i + 1}</span>
                    <span className="text-body-xs text-ink-tertiary">难度 {"⭐".repeat(ch.difficulty)}</span>
                  </div>
                  <h4 className="text-body font-bold">{ch.title}</h4>
                  <p className="text-body-sm text-ink-secondary">{ch.description}</p>
                  {ch.hint && (
                    <p className="text-body-xs text-ink-tertiary">💡 {ch.hint}</p>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        const accRes = await fetch("/api/user/account");
                        const { account } = await accRes.json();
                        const res = await fetch("/api/user/activity", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action_type: "complete_challenge",
                            action_target: ch.title,
                          }),
                        });
                        const result = await res.json();
                        if (result.new_badges?.length > 0) {
                          alert(`🎉 获得新徽章: ${result.new_badges.map((b: { name: string }) => b.name).join(", ")}`);
                        } else {
                          alert(`✅ 完成挑战！+${result.points_awarded} 分`);
                        }
                      } catch {
                        alert("积分记录失败，请检查网络连接");
                      }
                    }}
                    className="mt-2 bg-primary text-white border-none rounded-btn px-3 py-1.5 text-body-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    ✅ 完成挑战 (+20分)
                  </button>
                </div>
              ));
```

- [ ] **Step 6: Add badge congratulations to bubble-guide**

In `components/chat/bubble-guide.tsx`, add an optional `badgeNotifications` prop and render congratulations:

```typescript
"use client";

import { AudioPlayer } from "./audio-player";

interface BadgeNotification {
  name: string;
  icon: string;
}

interface Props {
  content: string;
  strategyId?: string | null;
  messageId?: string;
  badgeNotifications?: BadgeNotification[];
}

export function BubbleGuide({ content, strategyId, messageId, badgeNotifications }: Props) {
  return (
    <div className="flex gap-3 mb-4">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-white text-sm font-bold shrink-0 mt-1">
        K
      </div>
      {/* Bubble */}
      <div className="bubble-guide bg-bubble-guide border border-border rounded-tl-sm rounded-tr-bubble rounded-br-bubble rounded-bl-bubble px-5 py-4 text-body-lg shadow-sm max-w-[80%]">
        <p className="whitespace-pre-wrap">{content}</p>
        <AudioPlayer messageId={messageId || ""} text={content} />
        {strategyId && (
          <span className="inline-block mt-2 text-xs text-ink-tertiary bg-surface-raised px-2 py-0.5 rounded-full">
            {strategyId}
          </span>
        )}
        {badgeNotifications && badgeNotifications.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <p className="text-body-sm font-bold text-accent-yellow">🎉 新徽章解锁！</p>
            {badgeNotifications.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-body-sm">
                <span className="text-xl">{b.icon}</span>
                <span className="text-ink-secondary">{b.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 8: Run full lint check**

Run: `npx eslint app/page.tsx app/api/projects/\[id\]/check-in/route.ts app/api/projects/\[id\]/reflect/route.ts app/api/topics/\[id\]/generate/route.ts components/parent/topic-detail.tsx components/chat/bubble-guide.tsx 2>&1 | tail -20`
Expected: No errors (warnings ok).

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx \
  "app/api/projects/[id]/check-in/route.ts" \
  "app/api/projects/[id]/reflect/route.ts" \
  "app/api/topics/[id]/generate/route.ts" \
  components/parent/topic-detail.tsx \
  components/chat/bubble-guide.tsx
git commit -m "feat(p8a): integrate points engine into existing routes and navigation

- Add 👤 我的 nav link to home page
- Award check_in points after project check-in
- Award reflection points after project reflection
- Award explore_topic points after content generation
- Add challenge completion button to topic-detail
- Add badge congratulations support to bubble-guide"
```

---

## Self-Review Summary

1. **Spec coverage:** All 9 spec sections covered — data model (Task 1), points economy (Task 5), badges (Tasks 4+5), ranks (Task 6), API routes (Tasks 7-9), UI (Task 10), integration (Task 11), edge cases (handled in engine), global constraints (respected throughout).

2. **No placeholders:** Every step has actual code. No TBDs, TODOs, or "implement later" references.

3. **Type consistency:** `ActionType`, `BadgeRarity`, `RankTier`, `UnlockRule` defined in Task 1, consumed consistently in Tasks 2-11. `checkBadges` function name matches across Tasks 5 and 9. `AwardResult` interface matches between engine and API routes.
