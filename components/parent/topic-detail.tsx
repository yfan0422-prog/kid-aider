"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TopicCatalog, TopicContent, Challenge } from "@/lib/utils/types";
import { useLocale } from "@/lib/i18n/context";
import { useChild } from "@/components/ui/child-provider";
import { StartProjectDialog } from "./start-project-dialog";
import { useRouter } from "next/navigation";
import type { StartProjectResponse } from "@/lib/utils/types";

/** Strip basic markdown markers from LLM-generated intro text for display. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^###?\s+/gm, "")      // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1")      // italic
    .replace(/^>\s+/gm, "")           // blockquote
    .replace(/`(.+?)`/g, "$1");       // inline code
}

interface Props {
  topic: TopicCatalog;
  onBack: () => void;
  initialLanguage: string;
}

export function TopicDetail({ topic, onBack, initialLanguage }: Props) {
  const { t } = useLocale();
  const { childId } = useChild();
  const [content, setContent] = useState<TopicContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/topics/${topic.id}/contents?age_group=${topic.age_group}&language=${initialLanguage}`
      );
      const data = await res.json();
      if (data.hasContent) {
        setContent(data.content);
      } else {
        setContent(null);
      }
    } catch {
      setError(t("explore.content.error"));
    } finally {
      setLoading(false);
    }
  }, [topic.id, topic.age_group, initialLanguage, t]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Check for existing project linked to this topic
  useEffect(() => {
    fetch(`/api/topics/${topic.id}/projects`)
      .then(r => r.json())
      .then(d => {
        if (d.has_project) setLinkedProjectId(d.project_id);
      })
      .catch(() => {});
  }, [topic.id]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/topics/${topic.id}/generate?child_id=${encodeURIComponent(childId || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: initialLanguage }),
      });
      if (!res.ok) {
        setError(t("error.content_generation_failed"));
        setGenerating(false);
        return;
      }
      const data = await res.json();
      if (data.status === "generating") {
        // Poll for content
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const check = await fetch(
              `/api/topics/${topic.id}/contents?age_group=${topic.age_group}&language=${initialLanguage}`
            );
            const checkData = await check.json();
            if (checkData.hasContent) {
              setContent(checkData.content);
              setGenerating(false);
              clearInterval(poll);
              pollRef.current = null;
            } else if (attempts >= 90) {
              setError(t("error.content_generation_timeout"));
              setGenerating(false);
              clearInterval(poll);
              pollRef.current = null;
            }
          } catch {
            // Network error during poll — keep polling up to timeout
          }
        }, 2000);
        pollRef.current = poll;
      } else if (data.content) {
        // Content already exists (race between client fetch and generate POST)
        setContent(data.content);
        setGenerating(false);
      } else {
        // Unexpected response — stop spinner
        setError(t("error.content_generation_failed"));
        setGenerating(false);
      }
    } catch {
      setError(t("error.content_generation_failed"));
      setGenerating(false);
    }
  };

  const handleCompleteChallenge = async (title: string) => {
    try {
      const res = await fetch("/api/user/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "complete_challenge",
          action_target: title,
        }),
      });
      if (!res.ok) {
        alert(t("error.points_record_failed"));
        return;
      }
      const result = await res.json();
      if (result.new_badges?.length > 0) {
        const badgeNames = result.new_badges.map((b: { name: string }) => b.name).join(", ");
        alert(t("explore.challenge.badge_alert", { badges: badgeNames }));
      } else {
        alert(t("explore.challenge.completed_alert", { points: String(result.points_awarded) }));
      }
    } catch {
      alert(t("error.points_record_failed"));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="text-body-sm text-ink-tertiary hover:text-primary transition-colors"
        >
          {t("explore.back.catalog")}
        </button>
        <div className="bg-surface border border-border rounded-card p-8 text-center">
          <p className="text-ink-tertiary">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-body-sm text-ink-tertiary hover:text-primary transition-colors"
      >
        {t("explore.back.catalog")}
      </button>

      {error && (
        <div className="bg-brand-soft border border-brand rounded-card p-4">
          <p className="text-body-sm text-ink">{error}</p>
        </div>
      )}

      {!content && !generating && (
        <div className="bg-surface border border-border rounded-card p-8 text-center space-y-3">
          <div className="text-4xl">{topic.cover_image || "📚"}</div>
          <h2 className="text-body-lg font-bold">{topic.title}</h2>
          <p className="text-body-sm text-ink-tertiary">{topic.summary}</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm disabled:opacity-40"
          >
            {t("explore.start")}
          </button>
        </div>
      )}

      {generating && (
        <div className="bg-surface border border-border rounded-card p-8 text-center">
          <div className="text-4xl animate-bounce mb-3">✨</div>
          <p className="text-ink-tertiary">{t("explore.content.loading")}</p>
        </div>
      )}

      {content && (
        <div className="space-y-4">
          {/* Intro */}
          <section className="bg-surface border border-border rounded-card p-5">
            <div className="max-w-none text-body text-ink whitespace-pre-line">
              {stripMarkdown(content.intro_text)}
            </div>
          </section>

          {/* Challenges */}
          <section className="space-y-3">
            <h3 className="text-body-lg font-bold">{t("explore.challenge.title")}</h3>
            {(() => {
              const challenges: Challenge[] = JSON.parse(content.challenges);
              return challenges.map((ch, i) => (
                <div key={i} className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-body-sm font-bold text-primary">{t("explore.challenge.number", { n: String(i + 1) })}</span>
                    <span className={`text-body-xs px-2 py-0.5 rounded-btn ${ch.difficulty === 1 ? "bg-accent-green/15 text-accent-green" : ch.difficulty === 2 ? "bg-accent-yellow/15 text-ink-secondary" : "bg-primary/15 text-primary"}`}>
                      {"⭐".repeat(ch.difficulty)}
                    </span>
                    <span className="text-body-xs text-ink-tertiary ml-auto">⏱ {ch.estimated_minutes} {t("explore.challenge.minutes")}</span>
                  </div>
                  <h4 className="text-body font-bold mb-2">{ch.title}</h4>
                  <p className="text-body-sm text-ink-secondary mb-2">{ch.description}</p>
                  {ch.materials.length > 0 && (
                    <p className="text-body-xs text-ink-tertiary mb-2">
                      🧰 {t("explore.challenge.materials")}{ch.materials.join("、")}
                    </p>
                  )}
                  {ch.hint && (
                    <div className="mt-2 p-2 bg-surface-raised rounded-btn">
                      <p className="text-body-xs text-ink-tertiary">💡 {ch.hint}</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleCompleteChallenge(ch.title)}
                    className="mt-3 bg-primary text-white border-none rounded-btn px-3 py-1.5 text-body-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    {t("explore.challenge.complete")}
                  </button>
                </div>
              ));
            })()}
          </section>

          {/* Project cta */}
          {content.project_prompt && (
            <section className="bg-surface border border-border rounded-card p-5 text-center">
              <p className="text-body-sm text-ink-secondary mb-3">{content.project_prompt}</p>
              {linkedProjectId ? (
                <button
                  onClick={() => router.push(`/projects/${linkedProjectId}`)}
                  className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm hover:opacity-90 transition-opacity"
                >
                  📋 {t("explore.project.linked")}
                </button>
              ) : (
                <button
                  onClick={() => setShowStartDialog(true)}
                  className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm hover:opacity-90 transition-opacity"
                >
                  🚀 {t("explore.project.cta")}
                </button>
              )}
            </section>
          )}
        </div>
      )}

      {/* Start project dialog */}
      {content && (
        <StartProjectDialog
          topic={topic}
          content={content}
          open={showStartDialog}
          onClose={() => setShowStartDialog(false)}
          onSuccess={(result: StartProjectResponse) => {
            setShowStartDialog(false);
            setLinkedProjectId(result.project.id);
            if (result.session) {
              router.push(`/?session=${result.session.id}`);
            } else {
              router.push(`/projects/${result.project.id}`);
            }
          }}
        />
      )}
    </div>
  );
}
