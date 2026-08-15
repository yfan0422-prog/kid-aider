"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { VOICES, getStoredVoice, setStoredVoice } from "@/lib/voice/voices";

export function VoiceSelector() {
  const { t } = useLocale();
  const [selected, setSelected] = useState<string>(() => getStoredVoice());
  const [previewing, setPreviewing] = useState<string | null>(null);

  const select = (id: string) => {
    setStoredVoice(id);
    setSelected(id);
  };

  const preview = async (id: string) => {
    setPreviewing(id);
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t("settings.voice.preview_text"), voice: id, speed: 1.0 }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // 试听失败静默，不影响选择
    } finally {
      setPreviewing(null);
    }
  };

  return (
    <div className="space-y-2">
      {VOICES.map((v) => {
        const active = v.id === selected;
        return (
          <div
            key={v.id}
            className={`flex items-center gap-3 rounded-btn border p-3 ${
              active ? "border-primary" : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => select(v.id)}
              className="flex-1 text-left text-body-sm font-medium"
            >
              {t(v.key)}
              {active && <span className="ml-2 text-primary">✓</span>}
            </button>
            <button
              type="button"
              onClick={() => preview(v.id)}
              disabled={previewing === v.id}
              className="text-body-xs text-ink-tertiary hover:text-primary disabled:opacity-50"
            >
              {previewing === v.id ? t("common.loading") : `🔊 ${t("settings.voice.preview")}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
