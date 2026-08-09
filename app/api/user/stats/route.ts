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
