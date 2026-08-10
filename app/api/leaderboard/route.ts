import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/db/user-account";
import { getUnlockedBadges, initBadgeDefs } from "@/lib/db/badge-defs";
import { getRank } from "@/lib/engine/rank-engine";
import type { RankTier } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

const TIER_ORDER: RankTier[] = ["bronze", "silver", "gold", "diamond", "legendary"];

/** Local-only leaderboard: the single user's rank, points, and next-tier target. */
export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  initBadgeDefs();
  const account = getAccount(childId);
  if (!account) return NextResponse.json({ error: "child_not_found" }, { status: 404 });
  const rank = getRank(account.total_points);
  const unlocked = getUnlockedBadges(account.id);

  let nextTier: { tier: RankTier; points_needed: number } | null = null;
  if (rank.pointsToNext !== null) {
    const idx = TIER_ORDER.indexOf(rank.tier);
    const next = idx >= 0 && idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
    nextTier = next ? { tier: next, points_needed: rank.pointsToNext } : null;
  }

  return NextResponse.json({
    mode: "local" as const,
    rank_tier: rank.tier,
    rank_title: rank.title,
    rank_icon: rank.tierIcon,
    rank_text: rank.percentileText,
    total_points: account.total_points,
    badges_count: unlocked.length,
    next_tier: nextTier,
  });
}
