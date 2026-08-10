import { getDb } from "./index";
import type { ChildProfile, ProfileUpdate } from "@/lib/utils/types";
import { v4 as uuid } from "uuid";

// SQLite datetime 格式（与表 DEFAULT datetime('now') 及既有代码保持一致）
function now(): string {
  return new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

/** 按 child_id 获取画像；不存在则创建默认画像并返回。 */
export function getOrCreateChildProfile(childId: string): ChildProfile {
  const db = getDb();
  const existing = db.prepare(
    "SELECT * FROM child_profile WHERE child_id = ?"
  ).get(childId) as ChildProfile | undefined;
  if (existing) return existing;

  const ts = now();
  db.prepare(
    `INSERT INTO child_profile (id, child_id, ability_creativity, ability_logical, ability_focus, ability_expression, ability_curiosity, interest_tags, emotion_baseline, preferred_time_range, avg_session_minutes, engagement_trend, total_sessions, created_at, updated_at)
     VALUES (?, ?, 0.5, 0.5, 0.5, 0.5, 0.5, '[]', '{}', NULL, 0, 'stable', 0, ?, ?)`
  ).run(uuid(), childId, ts, ts);
  return getOrCreateChildProfile(childId);
}

/** 按 child_id 读取画像；不存在返回 null。 */
export function getChildProfile(childId: string): ChildProfile | null {
  const db = getDb();
  return db.prepare("SELECT * FROM child_profile WHERE child_id = ?")
    .get(childId) as ChildProfile | null;
}

// child_id / id / created_at / updated_at 由本模块管理，不允许通过 fields 写入
const UPDATABLE_KEYS = [
  "ability_creativity", "ability_logical", "ability_focus",
  "ability_expression", "ability_curiosity", "ability_updated_at",
  "interest_tags", "interest_updated_at",
  "emotion_baseline", "emotion_updated_at",
  "preferred_time_range", "avg_session_minutes",
  "engagement_trend", "total_sessions",
  "last_session_at", "deep_analysis_at",
] as const;

export function updateChildProfile(
  childId: string,
  fields: Partial<Omit<ChildProfile, "child_id">>
): ChildProfile {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const k of UPDATABLE_KEYS) {
    if (fields[k] !== undefined) {
      sets.push(`${k} = ?`);
      values.push(fields[k]);
    }
  }

  if (sets.length === 0) return getOrCreateChildProfile(childId);

  // 确保行存在，再应用更新，避免对不存在的子账号静默丢弃传入的 fields
  getOrCreateChildProfile(childId);

  sets.push("updated_at = ?");
  values.push(now());
  values.push(childId);

  db.prepare(`UPDATE child_profile SET ${sets.join(", ")} WHERE child_id = ?`).run(...values);
  return getOrCreateChildProfile(childId);
}

export function createProfileUpdate(attrs: {
  trigger: "session_start" | "session_end" | "deep_analysis";
  changes: Record<string, unknown>;
  snapshot?: Partial<ChildProfile> | null;
  child_id?: string;
}): ProfileUpdate {
  const db = getDb();
  const id = uuid();
  const ts = now();
  db.prepare(`
    INSERT INTO profile_updates (id, trigger, changes, snapshot, child_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, attrs.trigger, JSON.stringify(attrs.changes), attrs.snapshot ? JSON.stringify(attrs.snapshot) : null, attrs.child_id ?? "", ts);
  return {
    id, trigger: attrs.trigger,
    changes: JSON.stringify(attrs.changes),
    snapshot: attrs.snapshot ? JSON.stringify(attrs.snapshot) : null,
    created_at: ts,
  };
}
