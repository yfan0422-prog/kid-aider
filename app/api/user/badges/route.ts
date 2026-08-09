import { getOrCreateAccount } from "@/lib/db/user-account";
import { getAllBadgeDefs, getUnlockedBadges, initBadgeDefs } from "@/lib/db/badge-defs";
import { checkBadges } from "@/lib/engine/points-engine";

export const dynamic = "force-dynamic";

/** All badge definitions merged with the current account's unlock status. */
export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const allDefs = getAllBadgeDefs();
  const unlocked = getUnlockedBadges(account.id);

  // O(1) lookups for merge
  const unlockedIds = new Set(unlocked.map((u) => u.badge_id));
  const unlockedAtById = new Map(unlocked.map((u) => [u.badge_id, u.unlocked_at] as const));

  const badges = allDefs.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    category: def.category,
    rarity: def.rarity,
    points_value: def.points_value,
    unlock_rule: def.unlock_rule,
    unlocked: unlockedIds.has(def.id),
    unlocked_at: unlockedAtById.get(def.id) ?? null,
  }));

  return Response.json({ badges });
}

/**
 * Manual badge re-check: runs the badge evaluator and returns any badges newly
 * unlocked. Bonus points are already awarded inside `checkBadges`.
 */
export async function POST() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const newBadges = checkBadges(account.id);
  return Response.json({ new_badges: newBadges });
}
