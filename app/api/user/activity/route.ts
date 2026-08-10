import { getOrCreateAccount } from "@/lib/db/user-account";
import { getTodayActivities } from "@/lib/db/daily-activity";
import { awardPoints } from "@/lib/engine/points-engine";
import { initBadgeDefs } from "@/lib/db/badge-defs";
import type { ActionType } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const activities = getTodayActivities(account.id);
  const todayPoints = activities.reduce((sum, a) => sum + a.points, 0);

  return Response.json({
    today_points: todayPoints,
    streak: { current: account.current_streak, longest: account.longest_streak },
    activities,
  });
}

export async function POST(req: Request) {
  initBadgeDefs();
  const account = getOrCreateAccount();
  const body = await req.json().catch(() => ({}));
  const { action_type, action_target } = body as {
    action_type?: ActionType;
    action_target?: string;
  };

  if (!action_type) {
    return Response.json({ error: "action_type is required" }, { status: 400 });
  }

  const VALID_TYPES = new Set<string>(["login", "explore_topic", "complete_challenge", "task_done", "check_in", "reflection", "create_project"]);
  if (!VALID_TYPES.has(action_type)) {
    return Response.json({ error: `invalid action_type: ${action_type}` }, { status: 400 });
  }

  const result = awardPoints(account.id, action_type, action_target);
  const updated = getOrCreateAccount();

  return Response.json({
    ...result,
    current_streak: updated.current_streak,
    total_points: updated.total_points,
  });
}
