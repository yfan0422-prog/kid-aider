import type { RankTier } from "@/lib/utils/types";

interface RankInfo {
  tier: RankTier;
  title: string;
  tierIcon: string;
  percentileText: string;
  minPoints: number;
}

const RANKS: RankInfo[] = [
  { tier: "bronze",   title: "探索新手", tierIcon: "🥉", percentileText: "你超过了 30% 的探索者", minPoints: 0 },
  { tier: "silver",   title: "知识学徒", tierIcon: "🥈", percentileText: "你超过了 55% 的探索者", minPoints: 101 },
  { tier: "gold",     title: "智慧达人", tierIcon: "🥇", percentileText: "你超过了 80% 的探索者", minPoints: 501 },
  { tier: "diamond",  title: "博学大师", tierIcon: "💎", percentileText: "你超过了 95% 的探索者", minPoints: 2001 },
  { tier: "legendary",title: "传奇探索家", tierIcon: "👑", percentileText: "你在所有探索者中名列前茅", minPoints: 5001 },
];

export function getRank(totalPoints: number): {
  tier: RankTier;
  title: string;
  tierIcon: string;
  percentileText: string;
  pointsToNext: number | null;
} {
  let current = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (totalPoints >= RANKS[i].minPoints) {
      current = RANKS[i];
      break;
    }
  }

  const idx = RANKS.indexOf(current);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  const pointsToNext = next ? next.minPoints - totalPoints : null;

  return {
    tier: current.tier,
    title: current.title,
    tierIcon: current.tierIcon,
    percentileText: current.percentileText,
    pointsToNext,
  };
}
