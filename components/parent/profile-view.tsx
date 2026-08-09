"use client";

import { useEffect, useState } from "react";
import { RadarChart } from "@/components/growth/radar-chart";
import type { ChildProfile } from "@/lib/utils/types";

const ABILITY_DIMS = ["creativity", "logical", "focus", "expression", "curiosity"];

export function ProfileView() {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    await fetch("/api/profile/analyze", { method: "POST" });
    setAnalyzing(false);
    // Refresh
    const refresh = await fetch("/api/profile");
    const rd = await refresh.json();
    setProfile(rd.profile);
  };

  if (loading) {
    return <div className="p-6 text-ink-tertiary">加载中...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-ink-tertiary">暂无数据</div>;
  }

  const abilityData: Record<string, number> = {
    creativity: Math.round(profile.ability_creativity * 100),
    logical: Math.round(profile.ability_logical * 100),
    focus: Math.round(profile.ability_focus * 100),
    expression: Math.round(profile.ability_expression * 100),
    curiosity: Math.round(profile.ability_curiosity * 100),
  };

  const abilityLabels: Record<string, string> = {
    creativity: "创造力",
    logical: "逻辑力",
    focus: "专注力",
    expression: "表达力",
    curiosity: "好奇心",
  };

  const interests = JSON.parse(profile.interest_tags || "[]") as string[];
  const emotionBaseline = JSON.parse(profile.emotion_baseline || "{}") as Record<string, number>;

  const trendLabels: Record<string, string> = {
    rising: "📈 上升",
    stable: "➡️ 平稳",
    declining: "📉 下降",
  };

  const emotionEmoji: Record<string, string> = {
    excited: "🎉",
    calm: "😌",
    frustrated: "😟",
    impatient: "😤",
    confused: "🤔",
  };

  return (
    <div className="space-y-6">
      {/* 能力雷达图 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-4">📡 能力雷达</h2>
        <RadarChart
          data={abilityData}
          labels={abilityLabels}
          dimensions={ABILITY_DIMS}
          size={280}
        />
      </section>

      {/* 兴趣标签 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🏷️ 兴趣标签</h2>
        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {interests.map(tag => (
              <span key={tag} className="px-3 py-1 bg-surface-raised border border-border rounded-full text-body-sm">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-ink-tertiary text-body-sm">数据积累中，多聊聊就能发现兴趣方向</p>
        )}
      </section>

      {/* 情绪基线 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">💭 情绪分布</h2>
        {Object.keys(emotionBaseline).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(emotionBaseline).map(([emotion, ratio]) => (
              <div key={emotion} className="flex items-center gap-2">
                <span className="w-8">{emotionEmoji[emotion] || "❓"}</span>
                <div className="flex-1 h-4 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
                <span className="text-body-sm text-ink-tertiary w-10 text-right">
                  {Math.round(ratio * 100)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-tertiary text-body-sm">情绪数据积累中（需 ≥10 条记录）</p>
        )}
      </section>

      {/* 互动统计 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📊 互动统计</h2>
        <div className="grid grid-cols-2 gap-4 text-body-sm">
          <div>
            <span className="text-ink-tertiary">总对话次数</span>
            <p className="text-body-lg font-bold">{profile.total_sessions}</p>
          </div>
          <div>
            <span className="text-ink-tertiary">平均时长</span>
            <p className="text-body-lg font-bold">
              {profile.avg_session_minutes ? `${Math.round(profile.avg_session_minutes)} 分钟` : "—"}
            </p>
          </div>
          <div>
            <span className="text-ink-tertiary">最近活跃</span>
            <p className="text-body-lg font-bold">
              {profile.last_session_at
                ? new Date(profile.last_session_at).toLocaleDateString("zh-CN")
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-ink-tertiary">参与趋势</span>
            <p className="text-body-lg font-bold">{trendLabels[profile.engagement_trend] || "—"}</p>
          </div>
        </div>
      </section>

      {/* 深度分析触发 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-body-lg font-bold">🔬 深度分析</h2>
            <p className="text-body-sm text-ink-tertiary mt-1">
              {profile.deep_analysis_at
                ? `上次分析：${new Date(profile.deep_analysis_at).toLocaleString("zh-CN")}`
                : "尚未执行"}
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm disabled:opacity-40"
          >
            {analyzing ? "分析中..." : "立即分析"}
          </button>
        </div>
      </section>
    </div>
  );
}
