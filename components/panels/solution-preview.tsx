"use client";

import { useState } from "react";
import { useChatStore } from "@/lib/store/chat-store";

export function SolutionPreview() {
  const solutionPack = useChatStore((s) => s.solutionPack);
  const solutionStatus = useChatStore((s) => s.solutionStatus);
  const funnelComplete = useChatStore((s) => s.funnelComplete);
  const setSolutionStatus = useChatStore((s) => s.setSolutionStatus);
  const setSolutionPack = useChatStore((s) => s.setSolutionPack);
  const sessionId = useChatStore((s) => s.sessionId);
  const [isGenerating, setIsGenerating] = useState(false);

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

  if (!funnelComplete && solutionStatus === "idle") return null;

  return (
    <div className="p-4 border-t border-border">
      <h3 className="text-sm font-bold text-ink-secondary uppercase tracking-wider mb-4">
        方案包
      </h3>

      {solutionStatus === "idle" && funnelComplete && (
        <button
          onClick={handleGenerate}
          className="w-full bg-brand text-white border-none rounded-btn px-5 py-3.5 font-semibold text-[17px] shadow-[0_4px_12px_rgba(43,45,66,0.10)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-all"
        >
          ✨ 生成方案包
        </button>
      )}

      {solutionStatus === "generating" && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-body-sm text-ink-tertiary">正在生成方案包……</p>
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
                确认并复制 Agent Prompt
              </button>
            </div>
          )}
          {solutionStatus === "confirmed" && (
            <div className="bg-accent-green/10 text-accent-green rounded-btn px-4 py-3 text-sm font-semibold text-center">
              ✅ 方案包已确认！Prompt 已复制，去 Claude Code 试试吧！
            </div>
          )}
        </div>
      )}
    </div>
  );
}
