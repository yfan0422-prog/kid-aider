"use client";

import { useState } from "react";

// POST /api/competency?action=snapshot returns snapshots as a map keyed by
// dimension (not an array), and new_badges as {id, label, icon} subset.
interface SnapshotEntry {
  score: number;
  score_type: string; // "rule" | "ai"
  evidence: string;
}

interface SnapshotResult {
  snapshots: Record<string, SnapshotEntry>;
  new_badges: Array<{ id: string; label: string; icon: string }>;
  skipped?: boolean;
  message?: string;
}

const DIM_LABELS: Record<string, string> = {
  clarification: "需求澄清力", decomposition: "分解力",
  execution: "执行力", reflection: "反思力",
  creativity: "创造力", persistence: "坚持力",
};

export function DataPanel() {
  const [snapshotResult, setSnapshotResult] = useState<SnapshotResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const triggerSnapshot = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/competency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snapshot" }),
      });
      const data = await res.json();
      setSnapshotResult(data);
    } catch {
      setSnapshotResult(null);
    } finally {
      setGenerating(false);
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/parent/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kid-aider-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const entries = snapshotResult ? Object.entries(snapshotResult.snapshots) : [];

  return (
    <div className="space-y-6">
      {/* Manual snapshot trigger */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📸 手动生成快照</h2>
        <p className="text-body-sm text-ink-tertiary mb-3">
          立即生成本周能力快照，无需等待自然周触发
        </p>
        <button
          onClick={triggerSnapshot}
          disabled={generating}
          className="bg-primary text-white rounded-btn px-4 py-2 text-body-sm font-semibold disabled:opacity-50"
        >
          {generating ? "生成中..." : "生成本周快照"}
        </button>

        {snapshotResult && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {entries.map(([dimension, s]) => (
              <div key={dimension} className="flex items-center gap-2 text-body-sm">
                <span className="text-ink-tertiary">{DIM_LABELS[dimension] || dimension}</span>
                <span className="font-bold">{s.score}</span>
                <span className="text-ink-tertiary">({s.score_type === "rule" ? "规则" : "AI"})</span>
              </div>
            ))}
            {entries.length === 0 && (
              <p className="col-span-2 text-ink-tertiary text-body-sm">
                {snapshotResult.skipped ? (snapshotResult.message || "本周无新行为数据，快照已存在") : "本周暂无快照数据"}
              </p>
            )}
            {snapshotResult.new_badges.length > 0 && (
              <div className="col-span-2 mt-2 p-2 bg-yellow-50 rounded-btn text-body-sm">
                🎉 新徽章: {snapshotResult.new_badges.map(b => b.icon + b.label).join(", ")}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Full data export */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📦 数据导出</h2>
        <p className="text-body-sm text-ink-tertiary mb-3">
          导出全部数据为 JSON 文件（含会话、项目、能力画像、徽章）
        </p>
        <button
          onClick={exportAll}
          disabled={exporting}
          className="bg-primary text-white rounded-btn px-4 py-2 text-body-sm font-semibold disabled:opacity-50"
        >
          {exporting ? "导出中..." : "导出全部数据"}
        </button>
      </section>
    </div>
  );
}
