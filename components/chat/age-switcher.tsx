"use client";

import { useChatStore } from "@/lib/store/chat-store";
import type { AgeGroup } from "@/lib/utils/types";

const AGE_OPTIONS: { value: AgeGroup; label: string; emoji: string }[] = [
  { value: "6-9", label: "6–9 岁", emoji: "🌱" },
  { value: "10-12", label: "10–12 岁", emoji: "🌿" },
  { value: "13-15", label: "13–15 岁", emoji: "🌳" },
];

export function AgeSwitcher() {
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
          title={opt.label}
        >
          {opt.emoji}
        </button>
      ))}
    </div>
  );
}
