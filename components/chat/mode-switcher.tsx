"use client";

import { useChatStore } from "@/lib/store/chat-store";
import { useLocale } from "@/lib/i18n/context";
import type { InteractionMode } from "@/lib/utils/types";

const MODE_OPTIONS: { value: InteractionMode; emoji: string; labelKey: string }[] = [
  { value: "knowledge", emoji: "💡", labelKey: "chat.mode.knowledge" },
  { value: "writing", emoji: "✏️", labelKey: "chat.mode.writing" },
  { value: "creative", emoji: "🎨", labelKey: "chat.mode.creative" },
];

export function ModeSwitcher() {
  const { t } = useLocale();
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);

  return (
    <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-1">
      {MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setMode(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === opt.value
              ? "bg-white text-primary shadow-sm"
              : "text-ink-tertiary hover:text-ink-secondary"
          }`}
          title={t(opt.labelKey)}
        >
          <span>{opt.emoji}</span>
          <span>{t(opt.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
