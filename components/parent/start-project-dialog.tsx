"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { useChild } from "@/components/ui/child-provider";
import type { TopicCatalog, TopicContent, Challenge, StartProjectResponse } from "@/lib/utils/types";

interface Props {
  topic: TopicCatalog;
  content: TopicContent;
  open: boolean;
  onClose: () => void;
  onSuccess: (result: StartProjectResponse) => void;
}

export function StartProjectDialog({ topic, content, open, onClose, onSuccess }: Props) {
  const { t } = useLocale();
  const { childId } = useChild();
  const [projectName, setProjectName] = useState(topic.title);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const challenges: Challenge[] = JSON.parse(content.challenges);

  const handleStart = async (goto: "project" | "chat") => {
    if (!projectName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/topics/${topic.id}/start-project?child_id=${encodeURIComponent(childId || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: projectName.trim(), goto }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(t(data.error) || t("explore.project.dialog.error.default"));
        setSubmitting(false);
        return;
      }
      const result: StartProjectResponse = await res.json();
      onSuccess(result);
    } catch {
      setError(t("explore.project.dialog.error.network"));
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const difficultyLabel = (d: number): string =>
    d === 1 ? "★☆☆" : d === 2 ? "★★☆" : "★★★";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-card p-6 w-full max-w-md mx-4 shadow-lg space-y-4">
        {/* Title */}
        <div className="text-center">
          <div className="text-3xl mb-2">🚀</div>
          <h2 className="text-body-lg font-bold">{t("explore.project.dialog.title")}</h2>
        </div>

        {/* Project name input */}
        <div>
          <label className="text-body-sm text-ink-secondary block mb-1">{t("explore.project.dialog.name.label")}</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised focus:border-primary focus:outline-none"
            placeholder={t("explore.project.dialog.name.placeholder")}
            disabled={submitting}
          />
        </div>

        {/* Milestone preview */}
        <div>
          <p className="text-body-sm text-ink-secondary mb-2">{t("explore.project.dialog.milestones")}</p>
          <div className="bg-surface-raised rounded-btn p-3 space-y-2 max-h-40 overflow-y-auto">
            {challenges.length === 0 ? (
              <p className="text-body-sm text-ink-tertiary text-center">{t("explore.project.dialog.milestones.empty")}</p>
            ) : (
              challenges.map((ch, i) => (
                <div key={i} className="flex items-center gap-2 text-body-sm">
                  <span className="text-ink-tertiary">{i + 1}.</span>
                  <span className="text-ink flex-1 truncate">{ch.title}</span>
                  <span className="text-body-xs text-ink-tertiary shrink-0">
                    {difficultyLabel(ch.difficulty)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-brand-soft border border-brand rounded-btn p-3">
            <p className="text-body-sm text-ink">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          <button
            onClick={() => handleStart("project")}
            disabled={submitting || !projectName.trim()}
            className="w-full bg-primary text-white border-none rounded-btn py-2.5 font-semibold text-body-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {t("explore.project.dialog.btn.map")}
          </button>
          <button
            onClick={() => handleStart("chat")}
            disabled={submitting || !projectName.trim()}
            className="w-full bg-surface border-2 border-primary text-primary rounded-btn py-2.5 font-semibold text-body-sm disabled:opacity-40 hover:bg-surface-raised transition-colors"
          >
            {t("explore.project.dialog.btn.chat")}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-full text-ink-tertiary text-body-sm py-1 hover:text-ink transition-colors"
          >
            {t("explore.project.dialog.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
