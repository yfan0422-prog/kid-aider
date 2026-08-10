import { NextRequest, NextResponse } from "next/server";
import { upsertCheckIn, getCheckIns, getStreak } from "@/lib/db/check-ins";
import { addLog } from "@/lib/db/project-logs";
import { getProject } from "@/lib/db/projects";
import { recordEvent } from "@/lib/engine/evidence-collector";
import { awardPoints } from "@/lib/engine/points-engine";
import { getOrCreateAccount } from "@/lib/db/user-account";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    check_ins: getCheckIns(params.id),
    streak: getStreak(params.id),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "error.project_not_found" }, { status: 404 });
  }
  const { summary } = await req.json() as { summary: string };
  if (!summary) {
    return NextResponse.json({ error: "error.checkin_summary_required" }, { status: 400 });
  }
  const checkIn = upsertCheckIn(params.id, summary);
  addLog(params.id, "check_in", summary.slice(0, 100));
  // Record evidence event
  recordEvent("execution", "check_in", "check_ins", checkIn.id, {
    date: checkIn.date,
    summary: checkIn.summary,
  });
  // P8a: award habit points for check-in
  const account = getOrCreateAccount();
  awardPoints(account.id, "check_in", params.id);
  const streak = getStreak(params.id);
  return NextResponse.json({ check_in: checkIn, streak });
}
