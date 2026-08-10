import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/db/user-account";
import { getTodayActivities } from "@/lib/db/daily-activity";
import { awardPoints } from "@/lib/engine/points-engine";
import { initBadgeDefs } from "@/lib/db/badge-defs";
import type { ActionType } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  initBadgeDefs();
  const account = getAccount(childId);
  if (!account) return NextResponse.json({ error: "child_not_found" }, { status: 404 });
  const activities = getTodayActivities(account.id);
  const todayPoints = activities.reduce((sum, a) => sum + a.points, 0);

  return NextResponse.json({
    today_points: todayPoints,
    streak: { current: account.current_streak, longest: account.longest_streak },
    activities,
  });
}

export async function POST(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  initBadgeDefs();
  const account = getAccount(childId);
  if (!account) return NextResponse.json({ error: "child_not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const { action_type, action_target } = body as {
    action_type?: ActionType;
    action_target?: string;
  };

  if (!action_type) {
    return NextResponse.json({ error: "error.action_type_required" }, { status: 400 });
  }

  const VALID_TYPES = new Set<string>(["login", "explore_topic", "complete_challenge", "task_done", "check_in", "reflection", "create_project"]);
  if (!VALID_TYPES.has(action_type)) {
    return NextResponse.json({ error: `invalid action_type: ${action_type}` }, { status: 400 });
  }

  const result = awardPoints(account.id, action_type, action_target);
  const updated = getAccount(childId);
  if (!updated) return NextResponse.json({ error: "child_not_found" }, { status: 404 });

  return NextResponse.json({
    ...result,
    current_streak: updated.current_streak,
    total_points: updated.total_points,
  });
}
