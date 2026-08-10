import { NextRequest, NextResponse } from "next/server";
import { getOrCreateChildProfile, getChildProfile } from "@/lib/db/child-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const profile = getChildProfile(childId);
  if (!profile) {
    // 首次访问，创建默认画像
    const newProfile = getOrCreateChildProfile(childId);
    return NextResponse.json({ profile: newProfile, lastDeepAnalysis: null });
  }
  return NextResponse.json({
    profile,
    lastDeepAnalysis: profile.deep_analysis_at,
  });
}
