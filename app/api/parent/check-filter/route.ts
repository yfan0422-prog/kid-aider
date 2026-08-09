import { NextRequest, NextResponse } from "next/server";
import { getUsageConfig } from "@/lib/db/usage-config";
import { checkTextFilter } from "@/lib/db/filtered-words";

export async function POST(req: NextRequest) {
  const config = getUsageConfig();
  if (!config.filter_enabled) {
    return NextResponse.json({ blocked: false, matched: null, filter_disabled: true });
  }
  const { text } = await req.json() as { text: string };
  const result = checkTextFilter(text);
  return NextResponse.json({ ...result, filter_disabled: false });
}
