"use client";

import { useLocale } from "@/lib/i18n/context";
import type { Badge } from "@/lib/utils/types";

interface BadgeCardProps {
  badge: Badge;
}

export function BadgeCard({ badge }: BadgeCardProps) {
  const { t, locale } = useLocale();
  const earned = !!badge.earned_at;
  const earnedDate = badge.earned_at
    ? new Date(badge.earned_at).toLocaleDateString(locale)
    : null;

  return (
    <div
      className={`relative flex flex-col items-center p-3 rounded-card border transition-all ${
        earned
          ? "border-primary/30 bg-surface-raised shadow-sm"
          : "border-border bg-surface opacity-50 grayscale"
      }`}
    >
      <span className="text-2xl">{badge.icon}</span>
      <span className={`text-body-sm font-semibold mt-1 ${earned ? "text-ink" : "text-ink-tertiary"}`}>
        {badge.label}
      </span>
      {badge.tier === "gold" && earned && (
        <span className="text-[10px] text-yellow-500 mt-0.5">{t("growth.badge.tier.gold")}</span>
      )}
      {badge.tier === "silver" && earned && (
        <span className="text-[10px] text-slate-400 mt-0.5">{t("growth.badge.tier.silver")}</span>
      )}
      {earnedDate && (
        <span className="text-[10px] text-ink-tertiary mt-0.5">{earnedDate}</span>
      )}
      {!earned && (
        <span className="text-[10px] text-ink-tertiary mt-1 text-center leading-tight">
          {badge.description}
        </span>
      )}
    </div>
  );
}
