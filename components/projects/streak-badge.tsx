"use client";

import { useLocale } from "@/lib/i18n/context";

interface Props {
  current: number;
  longest: number;
}

export function StreakBadge({ current, longest }: Props) {
  const { t } = useLocale();
  const badge =
    current >= 30 ? "🏆" :
    current >= 14 ? "💎" :
    current >= 7 ? "🌟" :
    current >= 3 ? "🔥" : "";

  const message =
    current >= 30 ? t("project.streak.milestone.30") :
    current >= 14 ? t("project.streak.milestone.14") :
    current >= 7 ? t("project.streak.milestone.7") :
    current >= 3 ? t("project.streak.milestone.3") :
    current > 0 ? t("project.streak.count", { days: String(current) })
    : t("project.streak.start");

  return (
    <div className="flex items-center gap-2 text-body-sm">
      {badge && <span className="text-xl animate-bounce">{badge}</span>}
      <span className="text-ink-secondary">{message}</span>
      <span className="text-ink-tertiary">{t("project.streak.longest", { days: String(longest) })}</span>
    </div>
  );
}
