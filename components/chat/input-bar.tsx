"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore } from "@/lib/store/chat-store";
import { useLocale } from "@/lib/i18n/context";
import { AgeSwitcher } from "./age-switcher";
import { VoiceButton } from "./voice-button";
import { getAgeConfig } from "@/lib/utils/age-config";

export function InputBar() {
  const { t } = useLocale();
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
  const setFunnelNodes = useChatStore((s) => s.setFunnelNodes);
  const setSolutionStatus = useChatStore((s) => s.setSolutionStatus);

  // Ref to accumulate streaming text (avoid stale closure on streamingContent)
  const streamAccRef = useRef("");

  const handleVoiceTranscription = useCallback((text: string) => {
    setInput(text);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    const effectiveSessionId = sessionId || "";
    addMessage({
      id: crypto.randomUUID(),
      session_id: effectiveSessionId,
      role: "child",
      content: text,
      strategy_id: null,
      created_at: new Date().toISOString(),
    });

    setStreaming(true);
    clearStreamContent();
    streamAccRef.current = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, ageGroup }),
      });

      // Surface server errors
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg = (errBody as { error?: string }).error || t("chat.input.error.request_failed");
        addMessage({
          id: crypto.randomUUID(),
          session_id: effectiveSessionId,
          role: "guide",
          content: `⚠️ ${errMsg}`,
          strategy_id: null,
          created_at: new Date().toISOString(),
        });
        return;
      }

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
              streamAccRef.current += parsed.text;
              appendStreamContent(parsed.text);
            }
            if (parsed.error) {
              // Server-side error in stream — surface as a guide message
              addMessage({
                id: crypto.randomUUID(),
                session_id: effectiveSessionId,
                role: "guide",
                content: `⚠️ ${parsed.error}`,
                strategy_id: null,
                created_at: new Date().toISOString(),
              });
            }
            if (parsed.funnel_complete) {
              setFunnelComplete(true);
              setSolutionStatus("idle");
              // Fetch requirement nodes to populate funnel view
              fetch(`/api/requirements?sessionId=${sessionId || newSessionId}`)
                .then(r => r.json())
                .then(d => { if (d.nodes) setFunnelNodes(d.nodes); })
                .catch(console.error);
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }

      // Persist guide reply to messages (was cleared without persisting)
      const fullReply = streamAccRef.current;
      if (fullReply) {
        addMessage({
          id: crypto.randomUUID(),
          session_id: effectiveSessionId,
          role: "guide",
          content: fullReply,
          strategy_id: null,
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      addMessage({
        id: crypto.randomUUID(),
        session_id: effectiveSessionId,
        role: "guide",
        content: `⚠️ ${t("error.network")}`,
        strategy_id: null,
        created_at: new Date().toISOString(),
      });
    } finally {
      setStreaming(false);
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
    setFunnelNodes,
    setSessionId,
    setSolutionStatus,
    setStreaming,
    t,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const config = getAgeConfig(ageGroup);

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3">
          <VoiceButton
            onTranscription={handleVoiceTranscription}
            disabled={isStreaming}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? t("chat.input.placeholder.typing") : t("chat.input.placeholder")}
            rows={1}
            disabled={isStreaming}
            className={`flex-1 resize-none bg-surface-raised border-2 border-border rounded-btn px-5 py-3.5 ${config.fontSize} min-h-[56px] max-h-[120px] focus:border-primary focus:shadow-[0_0_0_4px_rgba(79,124,255,0.15)] focus:outline-none transition-all placeholder:text-ink-tertiary disabled:opacity-50`}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 bg-primary text-white border-none rounded-btn px-6 py-3.5 font-semibold text-[17px] shadow-[0_4px_12px_rgba(43,45,66,0.10)] hover:bg-primary-dark hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {t("chat.input.send")}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <AgeSwitcher />
          <span className="text-caption text-ink-tertiary">
            {t("chat.input.hint")}
          </span>
        </div>
      </div>
    </div>
  );
}
