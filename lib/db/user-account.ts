import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import fs from "fs";
import { deleteWorksByChild, resolveWorksPath } from "./works";

interface UserAccount {
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

export type { UserAccount };

/** 列出所有孩子 */
export function listAccounts(): UserAccount[] {
  const db = getDb();
  return db.prepare("SELECT * FROM user_account ORDER BY created_at ASC").all() as UserAccount[];
}

/** 获取单个孩子 */
export function getAccount(id: string): UserAccount | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM user_account WHERE id = ?").get(id) as UserAccount) ?? null;
}

/** 创建孩子 */
export function createAccount(
  name: string,
  avatar: string,
  age: string,
  lang: string
): UserAccount {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_account (id, display_name, avatar_emoji, age_group, language, total_points, current_streak, longest_streak, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
  ).run(id, name, avatar, age, lang, now, now);
  return getAccount(id)!;
}

/** 更新孩子信息（包括统计字段） */
export function updateAccount(
  id: string,
  fields: Partial<Pick<UserAccount, "display_name" | "avatar_emoji" | "age_group" | "language" | "total_points" | "current_streak" | "longest_streak">>
): UserAccount | null {
  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (fields.display_name !== undefined) { sets.push("display_name = ?"); values.push(fields.display_name); }
  if (fields.avatar_emoji !== undefined) { sets.push("avatar_emoji = ?"); values.push(fields.avatar_emoji); }
  if (fields.age_group !== undefined) { sets.push("age_group = ?"); values.push(fields.age_group); }
  if (fields.language !== undefined) { sets.push("language = ?"); values.push(fields.language); }
  if (fields.total_points !== undefined) { sets.push("total_points = ?"); values.push(fields.total_points); }
  if (fields.current_streak !== undefined) { sets.push("current_streak = ?"); values.push(fields.current_streak); }
  if (fields.longest_streak !== undefined) { sets.push("longest_streak = ?"); values.push(fields.longest_streak); }

  if (sets.length === 0) return getAccount(id);

  sets.push("updated_at = ?");
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE user_account SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getAccount(id);
}

/** 删除孩子及所有关联数据 */
export function deleteAccount(id: string): void {
  const db = getDb();
  const transaction = db.transaction(() => {
    // 删除项目及所有子实体
    const projectIds = db.prepare("SELECT id FROM projects WHERE child_id = ?").all(id) as { id: string }[];
    for (const p of projectIds) {
      // 从叶子到根删除，避免子查询因父行先行被删而失效（tracks 必须先于其子实体保留）
      db.prepare("DELETE FROM tasks WHERE milestone_id IN (SELECT id FROM milestones WHERE track_id IN (SELECT id FROM tracks WHERE project_id = ?))").run(p.id);
      db.prepare("DELETE FROM milestones WHERE track_id IN (SELECT id FROM tracks WHERE project_id = ?)").run(p.id);
      db.prepare("DELETE FROM tracks WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM check_ins WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM reflections WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM project_logs WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM projects WHERE id = ?").run(p.id);
    }

    // 删除会话及关联
    const sessionIds = db.prepare("SELECT id FROM sessions WHERE child_id = ?").all(id) as { id: string }[];
    for (const s of sessionIds) {
      db.prepare("DELETE FROM messages WHERE session_id = ?").run(s.id);
      db.prepare("DELETE FROM requirement_nodes WHERE session_id = ?").run(s.id);
      db.prepare("DELETE FROM solution_packs WHERE session_id = ?").run(s.id);
      db.prepare("DELETE FROM sessions WHERE id = ?").run(s.id);
    }

    // 删除其他关联数据
    db.prepare("DELETE FROM voice_sessions WHERE child_id = ?").run(id);
    db.prepare("DELETE FROM emotion_log WHERE child_id = ?").run(id);
    db.prepare("DELETE FROM child_profile WHERE child_id = ?").run(id);
    db.prepare("DELETE FROM profile_updates WHERE child_id = ?").run(id);
    db.prepare("DELETE FROM competency_snapshots WHERE child_id = ?").run(id);
    db.prepare("DELETE FROM evidence_events WHERE child_id = ?").run(id);
    db.prepare("DELETE FROM daily_activity WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM badge_unlock WHERE user_id = ?").run(id);

    // 删除账户
    db.prepare("DELETE FROM user_account WHERE id = ?").run(id);
  });
  transaction();

  // P10: 删除该孩子的作品行 + 磁盘文件
  const workPaths = deleteWorksByChild(id);
  for (const p of workPaths) {
    try { fs.unlinkSync(resolveWorksPath(p)); } catch { /* 文件可能已不存在 */ }
  }
}

/** 获取孩子总数（用于禁止删除最后一个） */
export function getChildCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as c FROM user_account").get() as { c: number };
  return row.c;
}
