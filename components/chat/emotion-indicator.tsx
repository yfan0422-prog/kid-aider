"use client";

interface Props {
  emotion: string | null;
}

const EMOTION_CONFIG: Record<string, { emoji: string; label: string }> = {
  excited: { emoji: "🎉", label: "兴奋" },
  calm: { emoji: "😌", label: "平静" },
  frustrated: { emoji: "😟", label: "沮丧" },
  impatient: { emoji: "😤", label: "着急" },
  confused: { emoji: "🤔", label: "困惑" },
};

export function EmotionIndicator({ emotion }: Props) {
  if (!emotion) return null;
  const config = EMOTION_CONFIG[emotion];
  if (!config) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-body-xs text-ink-tertiary bg-surface-raised px-1.5 py-0.5 rounded-full animate-pulse"
      title={`孩子情绪: ${config.label}`}
    >
      {config.emoji}
    </span>
  );
}
