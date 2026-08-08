"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useGrowthStore } from "@/lib/store/growth-store";
import { RadarChart } from "@/components/growth/radar-chart";
import { BadgeWall } from "@/components/growth/badge-wall";
import { TrendLine } from "@/components/growth/trend-line";

const DIM_LABELS: Record<string, string> = {
  clarification: "需求澄清",
  decomposition: "分解力",
  execution: "执行力",
  reflection: "反思力",
  creativity: "创造力",
  persistence: "坚持力",
};

const DIM_COLORS: Record<string, string> = {
  clarification: "#6366f1",
  decomposition: "#8b5cf6",
  execution: "#10b981",
  reflection: "#f59e0b",
  creativity: "#ec4899",
  persistence: "#3b82f6",
};

export default function GrowthPage() {
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
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">🌟 我的成长</h1>
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
            <p className="text-body-lg font-bold text-ink mb-2">🎉 新徽章解锁！</p>
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
              太棒了！
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          {/* Radar chart */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">📊 能力画像</h2>
            {Object.keys(radarData).length > 0 ? (
              <RadarChart data={radarData} labels={DIM_LABELS} size={320} />
            ) : (
              <p className="text-ink-tertiary text-body-sm text-center py-8">
                还没有能力数据，完成一些项目任务后回来看看吧！
              </p>
            )}
          </section>

          {/* Trend line */}
          {trends.length > 1 && (
            <section className="bg-surface border border-border rounded-card p-6">
              <h2 className="text-body-lg font-bold mb-4">📈 能力趋势</h2>
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
            <h2 className="text-body-lg font-bold mb-4">🏆 徽章墙</h2>
            {badges.length > 0 ? (
              <BadgeWall badges={badges} />
            ) : (
              <p className="text-ink-tertiary text-body-sm text-center py-8">徽章加载中...</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
