"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";

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

export function DataPanel() {
  const { t, locale } = useLocale();
  const DIM_LABELS: Record<string, string> = {
    clarification: t("growth.dimension.clarification"), decomposition: t("growth.dimension.decomposition"),
    execution: t("growth.dimension.execution"), reflection: t("growth.dimension.reflection"),
    creativity: t("growth.dimension.creativity"), persistence: t("growth.dimension.persistence"),
  };
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
      const res = await fetch(`/api/parent/export?lang=${encodeURIComponent(locale)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kid-aider-export.html";
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
        <h2 className="text-body-lg font-bold mb-3">📸 {t("parent.data.snapshot.title")}</h2>
        <p className="text-body-sm text-ink-tertiary mb-3">
          {t("parent.data.snapshot.desc")}
        </p>
        <button
          onClick={triggerSnapshot}
          disabled={generating}
          className="bg-primary text-white rounded-btn px-4 py-2 text-body-sm font-semibold disabled:opacity-50"
        >
          {generating ? t("parent.data.snapshot.generating") : t("parent.data.snapshot.generate")}
        </button>

        {snapshotResult && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {entries.map(([dimension, s]) => (
              <div key={dimension} className="flex items-center gap-2 text-body-sm">
                <span className="text-ink-tertiary">{DIM_LABELS[dimension] || dimension}</span>
                <span className="font-bold">{s.score}</span>
                <span className="text-ink-tertiary">({s.score_type === "rule" ? t("parent.data.rule") : "AI"})</span>
              </div>
            ))}
            {entries.length === 0 && (
              <p className="col-span-2 text-ink-tertiary text-body-sm">
                {snapshotResult.skipped ? (snapshotResult.message || t("parent.data.snapshot.skipped")) : t("parent.data.snapshot.empty")}
              </p>
            )}
            {snapshotResult.new_badges.length > 0 && (
              <div className="col-span-2 mt-2 p-2 bg-yellow-50 rounded-btn text-body-sm">
                🎉 {t("parent.data.new_badges", { badges: snapshotResult.new_badges.map(b => b.icon + b.label).join(", ") })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Full data export */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📦 {t("parent.data.export.title")}</h2>
        <p className="text-body-sm text-ink-tertiary mb-3">
          {t("parent.data.export.desc")}
        </p>
        <button
          onClick={exportAll}
          disabled={exporting}
          className="bg-primary text-white rounded-btn px-4 py-2 text-body-sm font-semibold disabled:opacity-50"
        >
          {exporting ? t("parent.data.export.exporting") : t("parent.data.export.all")}
        </button>
      </section>
    </div>
  );
}
