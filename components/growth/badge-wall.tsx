"use client";

import { useLocale } from "@/lib/i18n/context";
import type { Badge } from "@/lib/utils/types";
import { BadgeCard } from "./badge-card";

interface BadgeWallProps {
  badges: Badge[];
}

export function BadgeWall({ badges }: BadgeWallProps) {
  const { t } = useLocale();
  const DIMENSION_LABELS: Record<string, string> = {
    clarification: t("growth.dimension.clarification"),
    decomposition: t("growth.dimension.decomposition"),
    execution: t("growth.dimension.execution"),
    reflection: t("growth.dimension.reflection"),
    creativity: t("growth.dimension.creativity"),
    persistence: t("growth.dimension.persistence"),
  };

  // Group by category, then dimension
  const competencyBadges = badges.filter(b => b.category === "competency");
  const achievementBadges = badges.filter(b => b.category === "achievement");

  // Group competency by dimension
  const grouped = new Map<string, Badge[]>();
  for (const b of competencyBadges) {
    const key = b.dimension || "other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  }

  return (
    <div className="space-y-5">
      {/* Competency badges grouped by dimension */}
      {Array.from(grouped.entries()).map(([dim, dimBadges]) => (
        <div key={dim}>
          <h4 className="text-body-sm font-semibold text-ink-secondary mb-2">
            {DIMENSION_LABELS[dim] || dim}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {dimBadges.map(b => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        </div>
      ))}

      {/* Achievement badges */}
      {achievementBadges.length > 0 && (
        <div>
          <h4 className="text-body-sm font-semibold text-ink-secondary mb-2">{t("growth.badges.achievement")}</h4>
          <div className="grid grid-cols-3 gap-2">
            {achievementBadges.map(b => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
