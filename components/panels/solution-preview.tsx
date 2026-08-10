"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/lib/store/chat-store";
import { useLocale } from "@/lib/i18n/context";

export function SolutionPreview() {
  const { t } = useLocale();
  const solutionPack = useChatStore((s) => s.solutionPack);
  const solutionStatus = useChatStore((s) => s.solutionStatus);
  const funnelComplete = useChatStore((s) => s.funnelComplete);
  const setSolutionStatus = useChatStore((s) => s.setSolutionStatus);
  const setSolutionPack = useChatStore((s) => s.setSolutionPack);
  const sessionId = useChatStore((s) => s.sessionId);
  const ageGroup = useChatStore((s) => s.ageGroup);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    if (!sessionId || isGenerating) return;
    setIsGenerating(true);
    setSolutionStatus("generating");

    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.pack) {
        setSolutionPack(data.pack);
        setSolutionStatus("ready");
      } else {
        setSolutionStatus("idle");
      }
    } catch {
      setSolutionStatus("idle");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = () => {
    if (solutionPack) {
      // Copy agent prompt to clipboard
      const match = solutionPack.content.match(/agent_prompt:\s*\|?\n?([\s\S]*?)(?:\n\S|$)/);
      const prompt = match ? match[1].trim() : solutionPack.content;
      navigator.clipboard.writeText(prompt).catch(console.error);
      setSolutionStatus("confirmed");
    }
  };

  const handleStartProject = async () => {
    if (!sessionId || isStarting) return;
    setIsStarting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ageGroup }),
      });
      const data = await res.json();
      if (data.project?.id) {
        router.push(`/projects/${data.project.id}`);
      }
    } finally {
      setIsStarting(false);
    }
  };

  if (!funnelComplete && solutionStatus === "idle") return null;

  return (
    <div className="p-4 border-t border-border">
      <h3 className="text-sm font-bold text-ink-secondary uppercase tracking-wider mb-4">
        {t("funnel.pack.title")}
      </h3>

      {solutionStatus === "idle" && funnelComplete && (
        <button
          onClick={handleGenerate}
          className="w-full bg-brand text-white border-none rounded-btn px-5 py-3.5 font-semibold text-[17px] shadow-[0_4px_12px_rgba(43,45,66,0.10)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-all"
        >
          {t("funnel.pack.generate")}
        </button>
      )}

      {solutionStatus === "generating" && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-body-sm text-ink-tertiary">{t("funnel.pack.generating")}</p>
        </div>
      )}

      {(solutionStatus === "ready" || solutionStatus === "confirmed") && solutionPack && (
        <div className="space-y-3">
          <div className="bg-surface-raised rounded-2xl p-4">
            <h4 className="font-bold text-body mb-2">{solutionPack.title}</h4>
            <pre className="text-body-sm text-ink-secondary whitespace-pre-wrap font-sans max-h-[300px] overflow-y-auto">
              {solutionPack.content}
            </pre>
          </div>
          {solutionStatus === "ready" && (
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                className="flex-1 bg-primary text-white border-none rounded-btn px-4 py-3 font-semibold text-sm hover:bg-primary-dark transition-colors"
              >
                {t("funnel.pack.copy_prompt")}
              </button>
            </div>
          )}
          {solutionStatus === "confirmed" && (
            <div className="space-y-3">
              <div className="bg-accent-green/10 text-accent-green rounded-btn px-4 py-3 text-sm font-semibold text-center">
                {t("funnel.pack.confirmed")}
              </div>
              <button
                onClick={handleStartProject}
                disabled={isStarting}
                className="w-full bg-accent-green text-white border-none rounded-btn px-4 py-2.5 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isStarting ? t("funnel.pack.starting") : t("funnel.pack.start")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
