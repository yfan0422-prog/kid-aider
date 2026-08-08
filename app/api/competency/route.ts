import { NextRequest, NextResponse } from "next/server";
import { generateSnapshot } from "@/lib/engine/competency-scorer";
import { checkBadges, initBadgesIfNeeded } from "@/lib/engine/badge-evaluator";
import { getLatestSnapshots, getSnapshotsByRange } from "@/lib/db/competency-snapshots";
import { hasWeekEvents } from "@/lib/db/evidence-events";
import { getCurrentWeekStart } from "@/lib/engine/evidence-collector";

export async function GET() {
  initBadgesIfNeeded();
  const snapshots = getLatestSnapshots();
  const weekStart = getCurrentWeekStart();

  // Build trends: last 8 weeks
  const eightWeeksAgo = new Date(weekStart);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const startStr = eightWeeksAgo.toISOString().slice(0, 10);
  const allSnapshots = getSnapshotsByRange(startStr, weekStart);

  // Group by week_start
  const trends: Array<{ week_start: string; scores: Record<string, number> }> = [];
  const weekMap = new Map<string, Record<string, number>>();
  for (const s of allSnapshots) {
    if (!weekMap.has(s.week_start)) weekMap.set(s.week_start, {});
    weekMap.get(s.week_start)![s.dimension] = s.score;
  }
  for (const [ws, scores] of Array.from(weekMap)) {
    trends.push({ week_start: ws, scores });
  }
  trends.sort((a, b) => a.week_start.localeCompare(b.week_start));

  const latestWeek = snapshots[0]?.week_start || "";
  const snapshotMap: Record<string, { score: number; score_type: string; evidence: string }> = {};
  for (const s of snapshots) {
    snapshotMap[s.dimension] = { score: s.score, score_type: s.score_type, evidence: s.evidence };
  }

  return NextResponse.json({
    snapshots: snapshotMap,
    latest_week: latestWeek,
    trends,
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action?: string };

  if (action === "snapshot") {
    const weekStart = getCurrentWeekStart();

    // Idempotent snapshot generation: skip when there are no new events this
    // week AND snapshots already exist for this week. This avoids re-running
    // the 4 AI scoring calls on every /growth visit.
    const existingWeekSnapshots = getSnapshotsByRange(weekStart, weekStart);
    if (!hasWeekEvents(weekStart) && existingWeekSnapshots.length > 0) {
      return NextResponse.json({
        snapshots: {},
        new_badges: [],
        skipped: true,
        message: "本周无新行为数据",
      });
    }

    initBadgesIfNeeded();

    let snapshots: Awaited<ReturnType<typeof generateSnapshot>>;
    let newBadges: ReturnType<typeof checkBadges>;
    try {
      snapshots = await generateSnapshot(weekStart);
      newBadges = checkBadges();
    } catch (error) {
      // Don't surface partial data as success — return a clean error instead
      console.error("[competency] snapshot generation failed:", error);
      return NextResponse.json(
        { error: "快照生成失败，请稍后重试" },
        { status: 500 }
      );
    }

    const snapshotMap: Record<string, { score: number; score_type: string; evidence: string }> = {};
    for (const s of snapshots) {
      snapshotMap[s.dimension] = { score: s.score, score_type: s.score_type, evidence: s.evidence };
    }

    return NextResponse.json({
      snapshots: snapshotMap,
      new_badges: newBadges.map(b => ({ id: b.id, label: b.label, icon: b.icon })),
      skipped: false,
    });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
