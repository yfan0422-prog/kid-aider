"use client";

interface RankCardProps {
  rankIcon: string;
  rankTitle: string;
  rankTier: string;
  rankText: string;
  totalPoints: number;
  badgesCount: number;
  nextTier: { tier: string; points_needed: number } | null;
}

export function RankCard({ rankIcon, rankTitle, rankTier, rankText, totalPoints, badgesCount, nextTier }: RankCardProps) {
  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <h3 className="text-body-lg font-bold">🏆 段位排名</h3>

      <div className="text-center py-4">
        <div className="text-5xl mb-2">{rankIcon}</div>
        <div className="text-body-xl font-bold">{rankTitle}</div>
        <div className="text-body-xs text-ink-tertiary uppercase">{rankTier}</div>
      </div>

      <p className="text-body-sm text-ink-secondary text-center bg-surface-raised rounded-btn py-2 px-4">
        {rankText}
      </p>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-surface-raised rounded-btn p-3">
          <div className="text-body-xl font-bold text-primary">{totalPoints}</div>
          <div className="text-body-xs text-ink-tertiary">总积分</div>
        </div>
        <div className="bg-surface-raised rounded-btn p-3">
          <div className="text-body-xl font-bold text-accent-purple">{badgesCount}</div>
          <div className="text-body-xs text-ink-tertiary">徽章数</div>
        </div>
      </div>

      {nextTier && (
        <p className="text-body-sm text-ink-tertiary text-center">
          距离 {nextTier.tier} 还差 {nextTier.points_needed} 分
        </p>
      )}
    </div>
  );
}
