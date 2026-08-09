import { NextRequest, NextResponse } from "next/server";
import { getTodayUsageSec, recordUsageTime } from "@/lib/db/usage-log";

export async function GET() {
  const todaySec = getTodayUsageSec();
  return NextResponse.json({ today_sec: todaySec });
}

export async function POST(req: NextRequest) {
  const { delta_sec } = await req.json() as { delta_sec: number };
  const today = new Date().toISOString().slice(0, 10);
  recordUsageTime(today, delta_sec);
  return NextResponse.json({ today_sec: getTodayUsageSec() });
}
