"use client";

interface Props {
  current: number;
  longest: number;
}

export function StreakBadge({ current, longest }: Props) {
  const badge =
    current >= 30 ? "🏆" :
    current >= 14 ? "💎" :
    current >= 7 ? "🌟" :
    current >= 3 ? "🔥" : "";

  const message =
    current >= 30 ? "超级坚持！连续 30 天！" :
    current >= 14 ? "两周了！你太厉害了！" :
    current >= 7 ? "连续一周打卡！" :
    current >= 3 ? "连续 3 天！保持！" :
    current > 0 ? `连续 ${current} 天打卡` : "今天开始打卡吧！";

  return (
    <div className="flex items-center gap-2 text-body-sm">
      {badge && <span className="text-xl animate-bounce">{badge}</span>}
      <span className="text-ink-secondary">{message}</span>
      <span className="text-ink-tertiary">（最长 {longest} 天）</span>
    </div>
  );
}
