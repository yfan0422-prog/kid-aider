import { getOrCreateChildProfile, updateChildProfile, createProfileUpdate } from "@/lib/db/child-profile";
import { runDeepAnalysisSync } from "@/lib/engine/profile-builder";

const MIN_ANALYSIS_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 小时

export async function POST() {
  const profile = getOrCreateChildProfile();

  // 冷却检查
  if (profile.deep_analysis_at) {
    const lastTime = new Date(profile.deep_analysis_at).getTime();
    if (Date.now() - lastTime < MIN_ANALYSIS_INTERVAL_MS) {
      return Response.json({ status: "skipped", reason: "分析间隔不足 6 小时" });
    }
  }

  // 异步分析，立返
  setTimeout(() => {
    try {
      const updates = runDeepAnalysisSync(profile);
      updateChildProfile(profile.id, updates);
      createProfileUpdate({
        trigger: "deep_analysis",
        changes: Object.keys(updates).reduce((acc, k) => {
          acc[k] = (updates as Record<string, unknown>)[k];
          return acc;
        }, {} as Record<string, unknown>),
        snapshot: { ...profile, ...updates },
      });
    } catch (err) {
      console.error("[profile] deep analysis failed:", err);
    }
  }, 0);

  return Response.json({ status: "started" });
}
