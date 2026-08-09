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
