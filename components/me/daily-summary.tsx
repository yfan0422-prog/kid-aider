"use client";

import { useLocale } from "@/lib/i18n/context";

interface Activity {
  id: string;
  action_type: string;
  action_target: string | null;
  points: number;
  note: string | null;
  created_at: string;
}

interface DailySummaryProps {
  todayPoints: number;
  streak: { current: number; longest: number };
  activities: Activity[];
}

export function DailySummary({ todayPoints, streak, activities }: DailySummaryProps) {
  const { t } = useLocale();
  const ACTION_LABELS: Record<string, { icon: string; label: string }> = {
    login: { icon: "👋", label: t("me.activity.type.login") },
    explore_topic: { icon: "🔍", label: t("me.activity.type.explore_topic") },
    complete_challenge: { icon: "🎯", label: t("me.activity.type.complete_challenge") },
    task_done: { icon: "✅", label: t("me.activity.type.task_done") },
    check_in: { icon: "📋", label: t("me.activity.type.check_in") },
    reflection: { icon: "📝", label: t("me.activity.type.reflection") },
  };

  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-body-lg font-bold">📊 {t("me.activity.dynamics")}</h3>
        <div className="text-right">
          <span className="text-body-2xl font-bold text-primary">{todayPoints}</span>
          <span className="text-body-xs text-ink-tertiary ml-1">{t("me.points.unit")}</span>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="text-ink-tertiary text-body-sm py-4 text-center">
          {t("me.activity.empty.tip")}
        </p>
      ) : (
        <div className="space-y-2">
          {activities.map(a => {
            const meta = ACTION_LABELS[a.action_type] ?? { icon: "📌", label: a.action_type };
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-lg">{meta.icon}</span>
                <span className="flex-1 text-body-sm text-ink-secondary">{meta.label}</span>
                <span className="text-body-sm font-bold text-accent-green">+{a.points}</span>
                {a.note && (
                  <span className="text-body-xs text-ink-tertiary">({a.note})</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Streak summary */}
      <div className="flex items-center gap-4 text-body-sm text-ink-secondary pt-1 border-t border-border">
        <span>🔥 {t("me.streak.current")} <span className="font-bold text-primary">{streak.current}</span> {t("project.checkin.day")}</span>
        <span>🏅 {t("me.streak.longest")} <span className="font-bold text-primary">{streak.longest}</span> {t("project.checkin.day")}</span>
      </div>
    </div>
  );
}
