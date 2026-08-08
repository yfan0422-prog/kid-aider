import { getDb } from "./index";
import type { Badge } from "@/lib/utils/types";

export function getAllBadges(): Badge[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM badges ORDER BY category, dimension, tier"
  ).all() as Badge[];
}

export function getEarnedBadges(): Badge[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM badges WHERE earned_at IS NOT NULL ORDER BY earned_at DESC"
  ).all() as Badge[];
}

export function getUnearnedBadges(): Badge[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM badges WHERE earned_at IS NULL ORDER BY category, dimension, tier"
  ).all() as Badge[];
}

export function markBadgeEarned(id: string): Badge | undefined {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE badges SET earned_at = ? WHERE id = ?").run(now, id);
  return db.prepare("SELECT * FROM badges WHERE id = ?").get(id) as Badge | undefined;
}

/** Initialize 15 badge definitions. Safe to call multiple times — skips existing. */
export function initBadges(): void {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as count FROM badges").get() as { count: number };
  if (count.count > 0) return;

  const now = new Date().toISOString();
  const badges: Array<{
    id: string;
    name: string;
    label: string;
    tier: string;
    dimension: string | null;
    category: string;
    description: string;
    icon: string;
  }> = [
    // Competency badges — silver
    { id: "clarification-silver", name: "clarification-silver", label: "清晰表达者", tier: "silver", dimension: "clarification", category: "competency", description: "需求澄清力评分 ≥60 持续 2 周", icon: "🎯" },
    { id: "decomposition-silver", name: "decomposition-silver", label: "小拆分家", tier: "silver", dimension: "decomposition", category: "competency", description: "分解力评分 ≥60 持续 2 周", icon: "🧩" },
    { id: "execution-silver", name: "execution-silver", label: "行动派", tier: "silver", dimension: "execution", category: "competency", description: "执行力评分 ≥60 持续 2 周", icon: "⚡" },
    { id: "reflection-silver", name: "reflection-silver", label: "思考者", tier: "silver", dimension: "reflection", category: "competency", description: "反思力评分 ≥60 持续 2 周", icon: "💭" },
    { id: "creativity-silver", name: "creativity-silver", label: "创意火花", tier: "silver", dimension: "creativity", category: "competency", description: "创造力评分 ≥60 持续 2 周", icon: "✨" },
    { id: "persistence-silver", name: "persistence-silver", label: "坚持者", tier: "silver", dimension: "persistence", category: "competency", description: "坚持力评分 ≥60 持续 2 周", icon: "🌱" },
    // Competency badges — gold
    { id: "clarification-gold", name: "clarification-gold", label: "需求大师", tier: "gold", dimension: "clarification", category: "competency", description: "需求澄清力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "decomposition-gold", name: "decomposition-gold", label: "分解大师", tier: "gold", dimension: "decomposition", category: "competency", description: "分解力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "execution-gold", name: "execution-gold", label: "执行达人", tier: "gold", dimension: "execution", category: "competency", description: "执行力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "reflection-gold", name: "reflection-gold", label: "反思之星", tier: "gold", dimension: "reflection", category: "competency", description: "反思力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "creativity-gold", name: "creativity-gold", label: "创造大师", tier: "gold", dimension: "creativity", category: "competency", description: "创造力评分 ≥80 持续 4 周", icon: "🏅" },
    { id: "persistence-gold", name: "persistence-gold", label: "毅力冠军", tier: "gold", dimension: "persistence", category: "competency", description: "坚持力评分 ≥80 持续 4 周", icon: "🏅" },
    // Achievement badges
    { id: "first-complete", name: "first-complete", label: "首次完成", tier: "silver", dimension: null, category: "achievement", description: "完成第一个项目", icon: "🚀" },
    { id: "streak-21", name: "streak-21", label: "21天挑战", tier: "gold", dimension: null, category: "achievement", description: "连续打卡 21 天", icon: "📅" },
    { id: "comeback", name: "comeback", label: "卷土重来", tier: "silver", dimension: null, category: "achievement", description: "恢复暂停项目 3 次以上", icon: "🔄" },
  ];

  const insert = db.prepare(
    `INSERT INTO badges (id, name, label, tier, dimension, category, description, icon, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const b of badges) {
    insert.run(b.id, b.name, b.label, b.tier, b.dimension, b.category, b.description, b.icon, now);
  }
}
