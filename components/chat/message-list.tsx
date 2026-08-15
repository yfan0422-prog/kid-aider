"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/store/chat-store";
import { useLocale } from "@/lib/i18n/context";
import { BubbleGuide } from "./bubble-guide";
import { BubbleChild } from "./bubble-child";
import { StreamingBubble } from "./streaming-bubble";

export function MessageList() {
  const { t } = useLocale();
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const autoPlayId = useChatStore((s) => s.autoPlayId);
  const setAutoPlayId = useChatStore((s) => s.setAutoPlayId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full text-ink-tertiary">
          <div className="text-6xl mb-4">🌟</div>
          <p className="text-body-lg font-medium">{t("chat.empty")}</p>
          <p className="text-body-sm mt-2">{t("chat.empty.subtitle")}</p>
        </div>
      )}
      {messages.map((msg) =>
        msg.role === "guide" ? (
          <BubbleGuide key={msg.id} content={msg.content} strategyId={msg.strategy_id} messageId={msg.id} autoPlay={msg.id === autoPlayId} onAutoPlayed={() => setAutoPlayId(null)} />
        ) : msg.role === "child" ? (
          <BubbleChild key={msg.id} content={msg.content} />
        ) : null
      )}
      {isStreaming && <StreamingBubble content={streamingContent} />}
      <div ref={bottomRef} />
    </div>
  );
}
