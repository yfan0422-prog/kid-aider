import { getOrCreateChildProfile, getChildProfile } from "@/lib/db/child-profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = getChildProfile();
  if (!profile) {
    // 首次访问，创建默认画像
    const newProfile = getOrCreateChildProfile();
    return Response.json({ profile: newProfile, lastDeepAnalysis: null });
  }
  return Response.json({
    profile,
    lastDeepAnalysis: profile.deep_analysis_at,
  });
}
