"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocale } from "@/lib/i18n/context";

interface Props {
  messageId: string;
  text: string;
}

export function AudioPlayer({ text }: Props) {
  const { t } = useLocale();
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 卸载时释放对象 URL，避免内存泄漏
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // 自动播放：组件挂载时请求 TTS
  useEffect(() => {
    let cancelled = false;

    async function fetchTTS() {
      setState("loading");
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, speed: 1.0 }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // 自动播放
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setState("idle");
        audio.onerror = () => setState("error");
        try {
          await audio.play();
          setState("playing");
        } catch {
          // 浏览器阻止自动播放，保持 idle 状态
          setState("idle");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    fetchTTS();
    return () => { cancelled = true; };
  }, [text]);

  const replay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setState("playing");
    }
  }, []);

  // 错误或空文本不渲染
  if (state === "error" || !text.trim()) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <button
        type="button"
        onClick={state === "playing" ? undefined : replay}
        className={`text-body-xs flex items-center gap-1 px-2 py-0.5 rounded-btn transition-colors
          ${state === "playing" ? "text-primary" : "text-ink-tertiary hover:text-primary"}`}
        title={state === "idle" ? t("chat.audio.play") : state === "loading" ? t("common.loading") : t("chat.audio.playing")}
      >
        {state === "loading" ? (
          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <SpeakerIcon playing={state === "playing"} />
        )}
        <span>{t("chat.audio.read")}</span>
      </button>
    </div>
  );
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {playing && (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}
