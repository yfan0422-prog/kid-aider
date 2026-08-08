import type { Badge, CompetencyDimension } from "@/lib/utils/types";
import { getAllBadges, markBadgeEarned, initBadges } from "@/lib/db/badges";
import { getSnapshotsByRange } from "@/lib/db/competency-snapshots";
import { getDb } from "@/lib/db/index";

function getWeekOffset(weekStart: string, offset: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset * 7);
  return d.toISOString().slice(0, 10);
}

/** Check if a dimension score has been ≥threshold for `sustainedWeeks` consecutive weeks */
function scoreSustained(
  dimension: CompetencyDimension,
  threshold: number,
  sustainedWeeks: number
): boolean {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  const currentWeekStart = monday.toISOString().slice(0, 10);

  const startWeek = getWeekOffset(currentWeekStart, -(sustainedWeeks - 1));
  const snapshots = getSnapshotsByRange(startWeek, currentWeekStart);

  const dimSnapshots = snapshots.filter(s => s.dimension === dimension);

  // Need at least sustainedWeeks snapshots at or above threshold
  let consecutive = 0;
  for (let i = 0; i < sustainedWeeks; i++) {
    const week = getWeekOffset(startWeek, i);
    const snap = dimSnapshots.find(s => s.week_start === week);
    if (snap && snap.score >= threshold) {
      consecutive++;
    } else {
      consecutive = 0;
    }
  }

  return consecutive >= sustainedWeeks;
}

function checkAchievementBadge(badge: Badge): boolean {
  const db = getDb();

  switch (badge.name) {
    case "first-complete": {
      const row = db.prepare(
        "SELECT COUNT(*) as count FROM projects WHERE status = 'completed'"
      ).get() as { count: number };
      return row.count >= 1;
    }
    case "streak-21": {
      // Check longest streak ever reached ≥21
      const checkIns = db.prepare(
        "SELECT DISTINCT date FROM check_ins ORDER BY date ASC"
      ).all() as Array<{ date: string }>;

      if (checkIns.length === 0) return false;

      let maxStreak = 0;
      let currentStreak = 1;
      const dates = checkIns.map(c => c.date);

      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = 1;
        }
      }
      maxStreak = Math.max(maxStreak, currentStreak);
      return maxStreak >= 21;
    }
    case "comeback": {
      const row = db.prepare(
        "SELECT COUNT(*) as count FROM project_logs WHERE action = 'project_resume'"
      ).get() as { count: number };
      return row.count >= 3;
    }
    default:
      return false;
  }
}

export function initBadgesIfNeeded(): void {
  initBadges();
}

/** Check all unearned badges. Returns newly earned badges (empty array if none). */
export function checkBadges(): Badge[] {
  const allBadges = getAllBadges();
  const unearned = allBadges.filter(b => !b.earned_at);
  const newlyEarned: Badge[] = [];

  for (const badge of unearned) {
    let earned = false;

    if (badge.category === "competency" && badge.dimension) {
      const threshold = badge.tier === "gold" ? 80 : 60;
      const weeks = badge.tier === "gold" ? 4 : 2;
      earned = scoreSustained(badge.dimension as CompetencyDimension, threshold, weeks);
    } else if (badge.category === "achievement") {
      earned = checkAchievementBadge(badge);
    }

    if (earned) {
      const updated = markBadgeEarned(badge.id);
      if (updated) newlyEarned.push(updated);
    }
  }

  return newlyEarned;
}
