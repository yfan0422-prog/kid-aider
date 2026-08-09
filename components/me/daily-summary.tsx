"use client";

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

const ACTION_LABELS: Record<string, { icon: string; label: string }> = {
  login: { icon: "👋", label: "每日登录" },
  explore_topic: { icon: "🔍", label: "探索话题" },
  complete_challenge: { icon: "🎯", label: "完成挑战" },
  task_done: { icon: "✅", label: "完成任务" },
  check_in: { icon: "📋", label: "项目打卡" },
  reflection: { icon: "📝", label: "复盘反思" },
};

export function DailySummary({ todayPoints, streak, activities }: DailySummaryProps) {
  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-body-lg font-bold">📊 今日动态</h3>
        <div className="text-right">
          <span className="text-body-2xl font-bold text-primary">{todayPoints}</span>
          <span className="text-body-xs text-ink-tertiary ml-1">分</span>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="text-ink-tertiary text-body-sm py-4 text-center">
          今天还没有活动记录，去探索或完成项目吧！
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
        <span>🔥 当前连击 <span className="font-bold text-primary">{streak.current}</span> 天</span>
        <span>🏅 最长 <span className="font-bold text-primary">{streak.longest}</span> 天</span>
      </div>
    </div>
  );
}
