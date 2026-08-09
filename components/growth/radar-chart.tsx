"use client";

interface RadarChartProps {
  data: Record<string, number>; // dimension → 0-100 score
  labels: Record<string, string>; // dimension → Chinese label
  size?: number;
  dimensions?: string[]; // ordered dimension keys; defaults to DEFAULT_DIMENSIONS
}

const DEFAULT_DIMENSIONS = [
  "clarification",
  "decomposition",
  "execution",
  "reflection",
  "creativity",
  "persistence",
];

export function RadarChart({ data, labels, size = 280, dimensions }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const levels = 5; // 20, 40, 60, 80, 100

  const dims = dimensions ?? DEFAULT_DIMENSIONS;
  const angleStep = (2 * Math.PI) / dims.length;
  const startAngle = -Math.PI / 2; // Start from top

  // Grid rings
  const rings = Array.from({ length: levels }, (_, i) => {
    const r = radius * ((i + 1) / levels);
    const points = dims
      .map((_, j) => {
        const a = startAngle + j * angleStep;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      })
      .join(" ");
    return (
      <polygon
        key={`ring-${i}`}
        points={points}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={i === levels - 1 ? 1.5 : 0.5}
      />
    );
  });

  // Axes
  const axes = dims.map((_, i) => {
    const a = startAngle + i * angleStep;
    return (
      <line
        key={`axis-${i}`}
        x1={cx}
        y1={cy}
        x2={cx + radius * Math.cos(a)}
        y2={cy + radius * Math.sin(a)}
        stroke="#e5e7eb"
        strokeWidth={0.5}
      />
    );
  });

  // Data polygon
  const dataPoints = dims
    .map((dim, i) => {
      const score = data[dim] || 0;
      const r = radius * (score / 100);
      const a = startAngle + i * angleStep;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    })
    .join(" ");

  // Dim labels
  const labelElements = dims.map((dim, i) => {
    const a = startAngle + i * angleStep;
    const labelR = radius + 32;
    const lx = cx + labelR * Math.cos(a);
    const ly = cy + labelR * Math.sin(a);
    return (
      <text
        key={`label-${i}`}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-ink-tertiary text-[11px]"
      >
        {labels[dim] || dim}
      </text>
    );
  });

  // Score dots
  const dots = dims.map((dim, i) => {
    const score = data[dim] || 0;
    const r = radius * (score / 100);
    const a = startAngle + i * angleStep;
    return (
      <circle
        key={`dot-${i}`}
        cx={cx + r * Math.cos(a)}
        cy={cy + r * Math.sin(a)}
        r={3}
        className="fill-primary"
      />
    );
  });

  // Score labels
  const scoreLabels = dims.map((dim, i) => {
    const score = data[dim] || 0;
    const r = radius * (score / 100) + 14;
    const a = startAngle + i * angleStep;
    return (
      <text
        key={`score-${i}`}
        x={cx + r * Math.cos(a)}
        y={cy + r * Math.sin(a)}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-ink text-[10px] font-semibold"
      >
        {score}
      </text>
    );
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="mx-auto"
    >
      {rings}
      {axes}
      <polygon
        points={dataPoints}
        fill="rgba(99, 102, 241, 0.15)"
        stroke="rgb(99, 102, 241)"
        strokeWidth={2}
      />
      {dots}
      {scoreLabels}
      {labelElements}
    </svg>
  );
}
