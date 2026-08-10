"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";
import { useChild } from "@/components/ui/child-provider";
import { UserCard } from "@/components/me/user-card";
import { DailySummary } from "@/components/me/daily-summary";
import { BadgeCollection } from "@/components/me/badge-collection";
import { RankCard } from "@/components/me/rank-card";

interface MeData {
  account: {
    display_name: string;
    avatar_emoji: string;
    total_points: number;
    current_streak: number;
  };
  activity: {
    today_points: number;
    streak: { current: number; longest: number };
    activities: Array<{
      id: string;
      action_type: string;
      action_target: string | null;
      points: number;
      note: string | null;
      created_at: string;
    }>;
  };
  stats: {
    rank_tier: string;
    rank_title: string;
    rank_icon: string;
    rank_text: string;
    next_tier: number | null;
    badges_count: number;
    total_points: number;
  };
  badges: {
    badges: Array<{
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
    }>;
  };
  leaderboard: {
    next_tier: { tier: string; points_needed: number } | null;
  };
}

export default function MePage() {
  const { t } = useLocale();
  const { childId, childAccounts } = useChild();
  const currentChild = childAccounts.find((c) => c.id === childId);
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) return;
    setLoading(true);
    const currentChildId: string = childId;
    async function fetchAll() {
      const qs = `child_id=${encodeURIComponent(currentChildId)}`;
      const [accRes, actRes, statsRes, badgesRes, lbRes] = await Promise.all([
        fetch(`/api/user/account?${qs}`),
        fetch(`/api/user/activity?${qs}`),
        fetch(`/api/user/stats?${qs}`),
        fetch(`/api/user/badges?${qs}`),
        fetch(`/api/leaderboard?${qs}`),
      ]);
      const [account, activity, stats, badges, leaderboard] = await Promise.all([
        accRes.json(),
        actRes.json(),
        statsRes.json(),
        badgesRes.json(),
        lbRes.json(),
      ]);
      setData({ account, activity, stats, badges, leaderboard });
      setLoading(false);
    }
    fetchAll();
  }, [childId]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="text-ink-tertiary">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg">
      {/* 当前孩子 */}
      {currentChild && (
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-2xl">{currentChild.avatar_emoji}</span>
          <span className="text-body-lg font-semibold text-ink">{currentChild.display_name}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-ink-tertiary hover:text-primary transition-colors">
            {t("me.back")}
          </Link>
          <h1 className="text-body-lg font-bold text-ink">{t("me.title")}</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <UserCard
          displayName={data.account.display_name}
          avatarEmoji={data.account.avatar_emoji}
          rankIcon={data.stats.rank_icon}
          rankTitle={data.stats.rank_title}
          rankTier={data.stats.rank_tier}
          currentStreak={data.account.current_streak}
          totalPoints={data.stats.total_points}
          pointsToNext={data.stats.next_tier}
        />
        <DailySummary
          todayPoints={data.activity.today_points}
          streak={data.activity.streak}
          activities={data.activity.activities}
        />
        <BadgeCollection badges={data.badges.badges} />
        <RankCard
          rankIcon={data.stats.rank_icon}
          rankTitle={data.stats.rank_title}
          rankTier={data.stats.rank_tier}
          rankText={data.stats.rank_text}
          totalPoints={data.stats.total_points}
          badgesCount={data.stats.badges_count}
          nextTier={data.leaderboard.next_tier}
        />
      </main>
    </div>
  );
}
