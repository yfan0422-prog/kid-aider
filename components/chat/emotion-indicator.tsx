"use client";

import { useLocale } from "@/lib/i18n/context";

interface Props {
  emotion: string | null;
}

const EMOTION_CONFIG: Record<string, { emoji: string; key: string }> = {
  excited: { emoji: "🎉", key: "chat.emotion.excited" },
  calm: { emoji: "😌", key: "chat.emotion.calm" },
  frustrated: { emoji: "😟", key: "chat.emotion.frustrated" },
  impatient: { emoji: "😤", key: "chat.emotion.impatient" },
  confused: { emoji: "🤔", key: "chat.emotion.confused" },
};

export function EmotionIndicator({ emotion }: Props) {
  const { t } = useLocale();
  if (!emotion) return null;
  const config = EMOTION_CONFIG[emotion];
  if (!config) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-body-xs text-ink-tertiary bg-surface-raised px-1.5 py-0.5 rounded-full animate-pulse"
      title={t("chat.emotion.title", { emotion: t(config.key) })}
    >
      {config.emoji}
    </span>
  );
}
