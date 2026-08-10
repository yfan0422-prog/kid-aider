"use client";

import { useLocale } from "@/lib/i18n/context";

interface TrendPoint {
  week_start: string;
  scores: Record<string, number>;
}

interface TrendLineProps {
  trends: TrendPoint[];
  dimensions: string[];
  labels: Record<string, string>;
  colors: Record<string, string>;
  width?: number;
  height?: number;
}

const DEFAULT_COLORS: Record<string, string> = {
  clarification: "#6366f1",
  decomposition: "#8b5cf6",
  execution: "#10b981",
  reflection: "#f59e0b",
  creativity: "#ec4899",
  persistence: "#3b82f6",
};

export function TrendLine({
  trends,
  dimensions,
  labels,
  colors = DEFAULT_COLORS,
  width = 600,
  height = 240,
}: TrendLineProps) {
  const { t } = useLocale();
  if (trends.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-tertiary text-body-sm">
        {t("growth.trend.empty")}
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Format week label
  function formatWeek(ws: string): string {
    const parts = ws.split("-");
    return `${parts[1]}/${parts[2]}`;
  }

  // Y grid lines (every 20)
  const yGrid = [0, 20, 40, 60, 80, 100].map(score => {
    const y = padding.top + plotH - (score / 100) * plotH;
    return (
      <g key={`ygrid-${score}`}>
        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
        <text x={padding.left - 6} y={y + 4} textAnchor="end" className="fill-ink-tertiary text-[10px]">
          {score}
        </text>
      </g>
    );
  });

  // X labels
  const xStep = trends.length > 1 ? plotW / (trends.length - 1) : plotW;
  const xLabels = trends.map((t, i) => {
    const x = padding.left + i * xStep;
    return (
      <text
        key={`x-${i}`}
        x={x}
        y={height - 8}
        textAnchor="middle"
        className="fill-ink-tertiary text-[10px]"
      >
        {formatWeek(t.week_start)}
      </text>
    );
  });

  // Lines per dimension
  const lines = dimensions.map(dim => {
    const points = trends
      .map((t, i) => {
        const score = t.scores[dim];
        if (score === undefined) return null;
        const x = padding.left + i * xStep;
        const y = padding.top + plotH - (score / 100) * plotH;
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(" ");

    if (!points) return null;

    return (
      <g key={`line-${dim}`}>
        <polyline
          points={points}
          fill="none"
          stroke={colors[dim] || "#6366f1"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {trends.map((t, i) => {
          const score = t.scores[dim];
          if (score === undefined) return null;
          const x = padding.left + i * xStep;
          const y = padding.top + plotH - (score / 100) * plotH;
          return (
            <circle
              key={`dot-${dim}-${i}`}
              cx={x}
              cy={y}
              r={3}
              fill={colors[dim] || "#6366f1"}
            />
          );
        })}
      </g>
    );
  });

  // Legend
  const legend = dimensions.map((dim, i) => {
    const x = padding.left + i * 90;
    return (
      <g key={`legend-${dim}`}>
        <rect x={x} y={4} width={10} height={10} rx={2} fill={colors[dim] || "#6366f1"} />
        <text x={x + 14} y={13} className="fill-ink-tertiary text-[11px]">
          {labels[dim] || dim}
        </text>
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-2xl">
      {yGrid}
      {xLabels}
      {lines}
      {legend}
    </svg>
  );
}
