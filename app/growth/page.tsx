"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";
import { useGrowthStore } from "@/lib/store/growth-store";
import { RadarChart } from "@/components/growth/radar-chart";
import { BadgeWall } from "@/components/growth/badge-wall";
import { TrendLine } from "@/components/growth/trend-line";

const DIM_COLORS: Record<string, string> = {
  clarification: "#6366f1",
  decomposition: "#8b5cf6",
  execution: "#10b981",
  reflection: "#f59e0b",
  creativity: "#ec4899",
  persistence: "#3b82f6",
};

export default function GrowthPage() {
  const { t } = useLocale();
  const DIM_LABELS: Record<string, string> = {
    clarification: t("growth.dimension.clarification"),
    decomposition: t("growth.dimension.decomposition"),
    execution: t("growth.dimension.execution"),
    reflection: t("growth.dimension.reflection"),
    creativity: t("growth.dimension.creativity"),
    persistence: t("growth.dimension.persistence"),
  };
  const {
    snapshots,
    badges,
    trends,
    newBadges,
    loading,
    fetchGrowthData,
    triggerSnapshot,
    clearNewBadges,
  } = useGrowthStore();

  useEffect(() => {
    fetchGrowthData().then(() => {
      // Trigger snapshot if needed (API handles idempotency)
      triggerSnapshot();
    });
  }, []);

  // Show new badge celebration
  useEffect(() => {
    if (newBadges.length > 0) {
      const timer = setTimeout(() => clearNewBadges(), 5000);
      return () => clearTimeout(timer);
    }
  }, [newBadges]);

  // Build radar data from snapshots
  const radarData: Record<string, number> = {};
  for (const [dim, info] of Object.entries(snapshots)) {
    radarData[dim] = info.score;
  }

  const allDims = Object.keys(DIM_LABELS);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          {t("growth.back")}
        </Link>
        <h1 className="text-2xl font-bold">🌟 {t("growth.title")}</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* New badge celebration */}
      {newBadges.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in">
          <div className="bg-white rounded-card p-8 text-center shadow-xl animate-in zoom-in-95">
            <p className="text-body-lg font-bold text-ink mb-2">{t("chat.badge.unlocked")}</p>
            {newBadges.map(b => (
              <div key={b.id} className="flex items-center justify-center gap-2 my-2">
                <span className="text-3xl">{b.icon}</span>
                <span className="text-body font-semibold">{b.label}</span>
              </div>
            ))}
            <button
              onClick={clearNewBadges}
              className="mt-4 bg-primary text-white border-none rounded-btn px-6 py-2 font-semibold text-body-sm"
            >
              {t("growth.badge.awesome")}
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          {/* Radar chart */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">📊 {t("growth.radar.title")}</h2>
            {Object.keys(radarData).length > 0 ? (
              <RadarChart data={radarData} labels={DIM_LABELS} size={320} />
            ) : (
              <p className="text-ink-tertiary text-body-sm text-center py-8">
                {t("growth.empty")}
              </p>
            )}
          </section>

          {/* Trend line */}
          {trends.length > 1 && (
            <section className="bg-surface border border-border rounded-card p-6">
              <h2 className="text-body-lg font-bold mb-4">📈 {t("growth.trend.title")}</h2>
              <TrendLine
                trends={trends}
                dimensions={allDims}
                labels={DIM_LABELS}
                colors={DIM_COLORS}
              />
            </section>
          )}

          {/* Badge wall */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">🏆 {t("growth.badges.wall")}</h2>
            {badges.length > 0 ? (
              <BadgeWall badges={badges} />
            ) : (
              <p className="text-ink-tertiary text-body-sm text-center py-8">{t("growth.badges.loading")}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
