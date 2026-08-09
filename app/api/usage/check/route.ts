import { NextResponse } from "next/server";
import { getUsageConfig } from "@/lib/db/usage-config";
import { getTodayUsageSec } from "@/lib/db/usage-log";

/** Check if the child can start a new conversation right now */
export async function GET() {
  const config = getUsageConfig();

  // If restrictions are paused, allow everything
  if (config.restrictions_paused) {
    return NextResponse.json({ allowed: true });
  }

  // Check quiet hours
  if (config.quiet_start && config.quiet_end) {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = config.quiet_start.split(":").map(Number);
    const [eh, em] = config.quiet_end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    const inQuiet = startMin < endMin
      ? currentMin >= startMin && currentMin < endMin
      : currentMin >= startMin || currentMin < endMin; // overnight
    if (inQuiet) {
      return NextResponse.json({ allowed: false, reason: "quiet_hours" });
    }
  }

  // Check daily limit
  if (config.daily_limit_min) {
    const todaySec = getTodayUsageSec();
    const limitSec = config.daily_limit_min * 60;
    if (todaySec >= limitSec) {
      return NextResponse.json({ allowed: false, reason: "daily_limit", today_sec: todaySec, limit_sec: limitSec });
    }
  }

  return NextResponse.json({ allowed: true });
}
