"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { RadarChart } from "@/components/growth/radar-chart";
import type { ChildProfile } from "@/lib/utils/types";

const ABILITY_DIMS = ["creativity", "logical", "focus", "expression", "curiosity"];

export function ProfileView() {
  const { t, locale } = useLocale();
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
    return <div className="p-6 text-ink-tertiary">{t("common.loading")}</div>;
  }

  if (!profile) {
    return <div className="p-6 text-ink-tertiary">{t("common.empty")}</div>;
  }

  const abilityData: Record<string, number> = {
    creativity: Math.round(profile.ability_creativity * 100),
    logical: Math.round(profile.ability_logical * 100),
    focus: Math.round(profile.ability_focus * 100),
    expression: Math.round(profile.ability_expression * 100),
    curiosity: Math.round(profile.ability_curiosity * 100),
  };

  const abilityLabels: Record<string, string> = {
    creativity: t("parent.profile.ability.creativity"),
    logical: t("parent.profile.ability.logical"),
    focus: t("parent.profile.ability.focus"),
    expression: t("parent.profile.ability.expression"),
    curiosity: t("parent.profile.ability.curiosity"),
  };

  const interests = JSON.parse(profile.interest_tags || "[]") as string[];
  const emotionBaseline = JSON.parse(profile.emotion_baseline || "{}") as Record<string, number>;

  const trendLabels: Record<string, string> = {
    rising: `📈 ${t("parent.data.rising")}`,
    stable: `➡️ ${t("parent.data.stable")}`,
    declining: `📉 ${t("parent.data.declining")}`,
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
      {/* Ability radar */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-4">📡 {t("growth.radar.title")}</h2>
        <RadarChart
          data={abilityData}
          labels={abilityLabels}
          dimensions={ABILITY_DIMS}
          size={280}
        />
      </section>

      {/* Interest tags */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🏷️ {t("parent.profile.interests")}</h2>
        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {interests.map(tag => (
              <span key={tag} className="px-3 py-1 bg-surface-raised border border-border rounded-full text-body-sm">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-ink-tertiary text-body-sm">{t("parent.profile.interests.empty")}</p>
        )}
      </section>

      {/* Emotion baseline */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">💭 {t("parent.profile.emotions")}</h2>
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
          <p className="text-ink-tertiary text-body-sm">{t("parent.profile.emotions.empty")}</p>
        )}
      </section>

      {/* Interaction stats */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📊 {t("parent.profile.stats")}</h2>
        <div className="grid grid-cols-2 gap-4 text-body-sm">
          <div>
            <span className="text-ink-tertiary">{t("parent.data.sessions")}</span>
            <p className="text-body-lg font-bold">{profile.total_sessions}</p>
          </div>
          <div>
            <span className="text-ink-tertiary">{t("parent.data.avgDuration")}</span>
            <p className="text-body-lg font-bold">
              {profile.avg_session_minutes ? `${Math.round(profile.avg_session_minutes)} ${t("explore.challenge.minutes")}` : "—"}
            </p>
          </div>
          <div>
            <span className="text-ink-tertiary">{t("parent.data.last_active")}</span>
            <p className="text-body-lg font-bold">
              {profile.last_session_at
                ? new Date(profile.last_session_at).toLocaleDateString(locale)
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-ink-tertiary">{t("parent.data.engagement")}</span>
            <p className="text-body-lg font-bold">{trendLabels[profile.engagement_trend] || "—"}</p>
          </div>
        </div>
      </section>

      {/* Deep analysis trigger */}
      <section className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-body-lg font-bold">🔬 {t("parent.profile.deep_analysis")}</h2>
            <p className="text-body-sm text-ink-tertiary mt-1">
              {profile.deep_analysis_at
                ? t("parent.profile.last_analysis", { date: new Date(profile.deep_analysis_at).toLocaleString(locale) })
                : t("parent.profile.not_analyzed")}
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm disabled:opacity-40"
          >
            {analyzing ? t("parent.profile.analyzing") : t("parent.profile.analyze_now")}
          </button>
        </div>
      </section>
    </div>
  );
}
