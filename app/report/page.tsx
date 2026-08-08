"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RadarChart } from "@/components/growth/radar-chart";
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

interface ReportData {
  time_range: { start: string; end: string };
  trends: Array<{ week_start: string; scores: Record<string, number> }>;
  summary: {
    total_projects: number;
    completed_projects: number;
    total_tasks: number;
    total_tasks_done: number;
    task_completion_rate: number;
    badges_earned: number;
    current_streak: number;
  };
}

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [weeks, setWeeks] = useState(4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/report?weeks=${weeks}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [weeks]);

  // Build radar data from latest trend point
  const latestScores: Record<string, number> = {};
  if (data?.trends.length) {
    const latest = data.trends[data.trends.length - 1];
    Object.assign(latestScores, latest.scores);
  }

  const allDims = Object.keys(DIM_LABELS);

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
            ← 返回
          </Link>
          <h1 className="text-2xl font-bold">📊 成长报告</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={weeks}
            onChange={e => setWeeks(Number(e.target.value))}
            className="bg-surface border border-border rounded-btn px-3 py-1.5 text-body-sm"
          >
            <option value={4}>最近 4 周</option>
            <option value={8}>最近 8 周</option>
            <option value={52}>全部</option>
          </select>
          <button
            onClick={handleExport}
            className="bg-primary text-white border-none rounded-btn px-4 py-1.5 font-semibold text-body-sm"
          >
            📄 导出 PDF
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-6">
          {/* Time range */}
          <p className="text-body-sm text-ink-tertiary">
            数据范围：{data.time_range.start} ~ {data.time_range.end}
          </p>

          {/* Radar chart */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">能力画像</h2>
            {Object.keys(latestScores).length > 0 ? (
              <RadarChart data={latestScores} labels={DIM_LABELS} size={300} />
            ) : (
              <p className="text-ink-tertiary text-body-sm text-center py-8">暂无能力数据</p>
            )}
          </section>

          {/* Trend line */}
          {data.trends.length > 1 && (
            <section className="bg-surface border border-border rounded-card p-6 trend-section">
              <h2 className="text-body-lg font-bold mb-4">能力趋势</h2>
              <TrendLine
                trends={data.trends}
                dimensions={allDims}
                labels={DIM_LABELS}
                colors={DIM_COLORS}
              />
            </section>
          )}

          {/* Summary */}
          <section className="bg-surface border border-border rounded-card p-6">
            <h2 className="text-body-lg font-bold mb-4">项目摘要</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-page rounded-btn">
                <p className="text-2xl font-bold text-primary">{data.summary.completed_projects}</p>
                <p className="text-body-xs text-ink-tertiary">已完成项目</p>
              </div>
              <div className="text-center p-3 bg-page rounded-btn">
                <p className="text-2xl font-bold text-primary">{data.summary.total_projects}</p>
                <p className="text-body-xs text-ink-tertiary">总项目</p>
              </div>
              <div className="text-center p-3 bg-page rounded-btn">
                <p className="text-2xl font-bold text-primary">
                  {Math.round(data.summary.task_completion_rate * 100)}%
                </p>
                <p className="text-body-xs text-ink-tertiary">任务完成率</p>
              </div>
              <div className="text-center p-3 bg-page rounded-btn">
                <p className="text-2xl font-bold text-primary">{data.summary.badges_earned}</p>
                <p className="text-body-xs text-ink-tertiary">获得徽章</p>
              </div>
            </div>
            <div className="mt-3 text-body-sm text-ink-tertiary">
              当前连续打卡：{data.summary.current_streak} 天
              {" · "}
              完成 {data.summary.total_tasks_done}/{data.summary.total_tasks} 任务
            </div>
          </section>
        </div>
      )}

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .trend-section { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
