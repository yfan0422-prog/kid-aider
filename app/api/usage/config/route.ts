import { NextRequest, NextResponse } from "next/server";
import { getUsageConfig, updateUsageConfig } from "@/lib/db/usage-config";

export async function GET() {
  const config = getUsageConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  updateUsageConfig({
    daily_limit_min: body.daily_limit_min as number | null | undefined,
    quiet_start: body.quiet_start as string | null | undefined,
    quiet_end: body.quiet_end as string | null | undefined,
    filter_enabled: body.filter_enabled as number | undefined,
    restrictions_paused: body.restrictions_paused as number | undefined,
  });
  return NextResponse.json({ config: getUsageConfig() });
}
