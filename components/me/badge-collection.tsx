"use client";

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points_value: number;
  unlock_rule: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

interface BadgeCollectionProps {
  badges: BadgeItem[];
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-surface-raised border-border",
  rare: "bg-accent-blue/10 border-accent-blue/30",
  epic: "bg-accent-purple/10 border-accent-purple/30",
  legendary: "bg-accent-yellow/10 border-accent-yellow/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  explore: "🔍 探索",
  project: "🚀 项目",
  streak: "🔥 连击",
  special: "✨ 特殊",
};

export function BadgeCollection({ badges }: BadgeCollectionProps) {
  // Preserve first-seen order; avoids Set-spread (tsconfig target is ES5, no downlevelIteration)
  const categories: string[] = [];
  for (const b of badges) {
    if (!categories.includes(b.category)) categories.push(b.category);
  }

  return (
    <div className="bg-surface border border-border rounded-card p-6 space-y-4">
      <h3 className="text-body-lg font-bold">🏅 徽章收集</h3>

      {categories.map(cat => {
        const catBadges = badges.filter(b => b.category === cat);
        const unlockedCount = catBadges.filter(b => b.unlocked).length;
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-body-sm font-bold text-ink-secondary">
                {CATEGORY_LABELS[cat] ?? cat}
              </h4>
              <span className="text-body-xs text-ink-tertiary">
                {unlockedCount}/{catBadges.length}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {catBadges.map(b => (
                <div
                  key={b.id}
                  className={`relative flex flex-col items-center p-3 rounded-card border transition-all ${
                    b.unlocked
                      ? `${RARITY_COLORS[b.rarity] ?? RARITY_COLORS.common}`
                      : "bg-surface-raised border-border opacity-50 grayscale"
                  }`}
                  title={b.unlocked ? `${b.name}: ${b.description}` : `${b.description} (未解锁)`}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-body-xs mt-1 text-center leading-tight">{b.name}</span>
                  {!b.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg">🔒</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
