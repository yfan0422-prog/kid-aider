"use client";

import { useChatStore } from "@/lib/store/chat-store";
import { useLocale } from "@/lib/i18n/context";
import type { AgeGroup } from "@/lib/utils/types";

const AGE_OPTIONS: { value: AgeGroup; emoji: string }[] = [
  { value: "6-9", emoji: "🌱" },
  { value: "10-12", emoji: "🌿" },
  { value: "13-15", emoji: "🌳" },
];

const AGE_LABEL_KEYS: Record<AgeGroup, string> = {
  "6-9": "chat.age.6-9",
  "10-12": "chat.age.10-12",
  "13-15": "chat.age.13-15",
};

export function AgeSwitcher() {
  const { t } = useLocale();
  const ageGroup = useChatStore((s) => s.ageGroup);
  const setAgeGroup = useChatStore((s) => s.setAgeGroup);

  return (
    <div className="flex items-center gap-1 bg-surface-raised rounded-lg p-1">
      {AGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setAgeGroup(opt.value)}
          className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
            ageGroup === opt.value
              ? "bg-white text-primary shadow-sm"
              : "text-ink-tertiary hover:text-ink-secondary"
          }`}
          title={t(AGE_LABEL_KEYS[opt.value])}
        >
          {opt.emoji}
        </button>
      ))}
    </div>
  );
}
