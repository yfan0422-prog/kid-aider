"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TopicCatalog, TopicContent, Challenge } from "@/lib/utils/types";

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
  const [content, setContent] = useState<TopicContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setError("无法加载内容");
    } finally {
      setLoading(false);
    }
  }, [topic.id, topic.age_group, initialLanguage]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/topics/${topic.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: initialLanguage }),
      });
      if (!res.ok) {
        setError("生成失败，请稍后重试");
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
            } else if (attempts >= 30) {
              setError("内容生成超时，请稍后重试");
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
        setError("生成失败，请稍后重试");
        setGenerating(false);
      }
    } catch {
      setError("生成失败，请稍后重试");
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="text-body-sm text-ink-tertiary hover:text-primary transition-colors"
        >
          ← 返回目录
        </button>
        <div className="bg-surface border border-border rounded-card p-8 text-center">
          <p className="text-ink-tertiary">加载中...</p>
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
        ← 返回目录
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
            开始探索
          </button>
        </div>
      )}

      {generating && (
        <div className="bg-surface border border-border rounded-card p-8 text-center">
          <div className="text-4xl animate-bounce mb-3">✨</div>
          <p className="text-ink-tertiary">正在准备内容...</p>
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
            <h3 className="text-body-lg font-bold">🎯 互动挑战</h3>
            {(() => {
              const challenges: Challenge[] = JSON.parse(content.challenges);
              return challenges.map((ch, i) => (
                <div key={i} className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-body-sm font-bold text-primary">挑战 {i + 1}</span>
                    <span className={`text-body-xs px-2 py-0.5 rounded-btn ${ch.difficulty === 1 ? "bg-accent-green/15 text-accent-green" : ch.difficulty === 2 ? "bg-accent-yellow/15 text-ink-secondary" : "bg-primary/15 text-primary"}`}>
                      {"⭐".repeat(ch.difficulty)}
                    </span>
                    <span className="text-body-xs text-ink-tertiary ml-auto">⏱ {ch.estimated_minutes} 分钟</span>
                  </div>
                  <h4 className="text-body font-bold mb-2">{ch.title}</h4>
                  <p className="text-body-sm text-ink-secondary mb-2">{ch.description}</p>
                  {ch.materials.length > 0 && (
                    <p className="text-body-xs text-ink-tertiary mb-2">
                      🧰 材料：{ch.materials.join("、")}
                    </p>
                  )}
                  {ch.hint && (
                    <div className="mt-2 p-2 bg-surface-raised rounded-btn">
                      <p className="text-body-xs text-ink-tertiary">💡 {ch.hint}</p>
                    </div>
                  )}
                </div>
              ));
            })()}
          </section>

          {/* Project cta */}
          {content.project_prompt && (
            <section className="bg-surface border border-border rounded-card p-5 text-center">
              <p className="text-body-sm text-ink-secondary mb-3">{content.project_prompt}</p>
              <button
                onClick={() => {/* TODO: integrate with project funnel in P8 */}}
                className="bg-primary text-white border-none rounded-btn px-5 py-2.5 font-semibold text-body-sm"
              >
                🚀 进入项目工坊
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
