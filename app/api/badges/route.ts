import { NextRequest, NextResponse } from "next/server";
import { getAllBadges, getEarnedBadges } from "@/lib/db/badges";
import { checkBadges, initBadgesIfNeeded } from "@/lib/engine/badge-evaluator";

export async function GET(req: NextRequest) {
  initBadgesIfNeeded();

  const url = new URL(req.url);
  const earnedOnly = url.searchParams.get("earned") === "true";

  const badges = earnedOnly ? getEarnedBadges() : getAllBadges();

  return NextResponse.json({
    badges,
    earned_count: getEarnedBadges().length,
    total_count: getAllBadges().length,
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action?: string };

  if (action === "check") {
    initBadgesIfNeeded();
    const newBadges = checkBadges();
    return NextResponse.json({
      new_badges: newBadges.map(b => ({ id: b.id, label: b.label, icon: b.icon })),
    });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
