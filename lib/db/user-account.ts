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
