"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";

interface UserCardProps {
  displayName: string;
  avatarEmoji: string;
  rankIcon: string;
  rankTitle: string;
  rankTier: string;
  currentStreak: number;
  totalPoints: number;
  pointsToNext: number | null;
}

export function UserCard({
  displayName,
  avatarEmoji,
  rankIcon,
  rankTitle,
  rankTier,
  currentStreak,
  totalPoints,
  pointsToNext,
}: UserCardProps) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      // Don't persist an empty name — reset to the last saved value.
      setName(displayName);
      setEditing(false);
      return;
    }
    await fetch("/api/user/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: trimmed }),
    });
    setEditing(false);
  };

  // Compute progress percentage within current tier
  const tierThresholds: Record<string, number> = {
    bronze: 100,
    silver: 500,
    gold: 2000,
    diamond: 5000,
    legendary: 5001,
  };
  const prevThresholds: Record<string, number> = {
    bronze: 0,
    silver: 101,
    gold: 501,
    diamond: 2001,
    legendary: 5001,
  };
  const tierMax = tierThresholds[rankTier] ?? 100;
  const tierMin = prevThresholds[rankTier] ?? 0;
  const progressPct =
    rankTier === "legendary"
      ? 100
      : Math.min(100, Math.round(((totalPoints - tierMin) / (tierMax - tierMin)) * 100));

  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-5xl">{avatarEmoji}</div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-border rounded-btn text-body bg-surface-raised"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="bg-primary text-white border-none rounded-btn px-3 py-1.5 text-body-sm font-semibold"
              >
                {t("common.save")}
              </button>
              <button
                onClick={() => { setName(displayName); setEditing(false); }}
                className="text-ink-tertiary text-body-sm"
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <h2
              className="text-body-lg font-bold cursor-pointer hover:text-primary transition-colors"
              onClick={() => setEditing(true)}
              title={t("me.name.edit_hint")}
            >
              {name} ✏️
            </h2>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl">{rankIcon}</span>
            <span className="text-body-sm text-ink-secondary">{rankTitle}</span>
            <span className="text-body-xs text-ink-tertiary px-2 py-0.5 bg-surface-raised rounded-full">
              {rankTier}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-body-2xl font-bold text-primary">{totalPoints}</div>
          <div className="text-body-xs text-ink-tertiary">{t("me.total_points")}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-body-xs text-ink-tertiary mb-1">
          <span>{t("me.rank.progress")}</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {pointsToNext !== null && (
          <p className="text-body-xs text-ink-tertiary mt-1">
            {t("me.rank.next", { points: String(pointsToNext) })}
          </p>
        )}
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2 text-body-sm">
        <span>🔥</span>
        <span className="text-ink-secondary">{t("project.checkin.streak")}</span>
        <span className="font-bold text-primary">{currentStreak}</span>
        <span className="text-ink-secondary">{t("project.checkin.day")}</span>
      </div>
    </div>
  );
}
