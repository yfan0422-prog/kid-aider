"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore } from "@/lib/store/chat-store";
import { AgeSwitcher } from "./age-switcher";
import { getAgeConfig } from "@/lib/utils/age-config";

export function InputBar() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ageGroup = useChatStore((s) => s.ageGroup);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sessionId = useChatStore((s) => s.sessionId);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const appendStreamContent = useChatStore((s) => s.appendStreamContent);
  const clearStreamContent = useChatStore((s) => s.clearStreamContent);
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setFunnelComplete = useChatStore((s) => s.setFunnelComplete);
  const setSolutionStatus = useChatStore((s) => s.setSolutionStatus);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    addMessage({
      id: crypto.randomUUID(),
      session_id: sessionId || "",
      role: "child",
      content: text,
      strategy_id: null,
      created_at: new Date().toISOString(),
    });

    setStreaming(true);
    clearStreamContent();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, ageGroup }),
      });

      const newSessionId = response.headers.get("X-Session-Id");
      if (newSessionId && !sessionId) setSessionId(newSessionId);

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              appendStreamContent(parsed.text);
            }
            if (parsed.funnel_complete) {
              setFunnelComplete(true);
              setSolutionStatus("idle");
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setStreaming(false);
      // Flush streaming content as a guide message
      clearStreamContent();
    }
  }, [
    input,
    isStreaming,
    sessionId,
    ageGroup,
    addMessage,
    appendStreamContent,
    clearStreamContent,
    setFunnelComplete,
    setSessionId,
    setSolutionStatus,
    setStreaming,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const config = getAgeConfig(ageGroup);

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "小K正在打字……" : "说说你的想法……"}
            rows={1}
            disabled={isStreaming}
            className={`flex-1 resize-none bg-surface-raised border-2 border-border rounded-btn px-5 py-3.5 ${config.fontSize} min-h-[56px] max-h-[120px] focus:border-primary focus:shadow-[0_0_0_4px_rgba(79,124,255,0.15)] focus:outline-none transition-all placeholder:text-ink-tertiary disabled:opacity-50`}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 bg-primary text-white border-none rounded-btn px-6 py-3.5 font-semibold text-[17px] shadow-[0_4px_12px_rgba(43,45,66,0.10)] hover:bg-primary-dark hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            发送
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <AgeSwitcher />
          <span className="text-caption text-ink-tertiary">
            按 Enter 发送，Shift+Enter 换行
          </span>
        </div>
      </div>
    </div>
  );
}
