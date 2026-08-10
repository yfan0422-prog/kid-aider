import { getOrCreateAccount, updateAccountStats } from "@/lib/db/user-account";
import {
  createActivity,
  countActionToday,
  getRecentDates,
  getActionCount,
} from "@/lib/db/daily-activity";
import { getAllBadgeDefs, getUnlockedBadgeIds, unlockBadge } from "@/lib/db/badge-defs";
import { getDb } from "@/lib/db/index";
import type { ActionType, UnlockRule } from "@/lib/utils/types";

/** Max times an action type can earn points per (user, action_type, day). */
const DAILY_CAPS: Record<ActionType, number> = {
  login: 1,
  explore_topic: 3,
  complete_challenge: 5,
  task_done: 99,
  check_in: 3,
  reflection: 2,
  create_project: 3,
};

/** Base points per action; check_in/reflection carry the streak multiplier. */
const POINTS_RULES: Record<ActionType, { base: number; streakEligible: boolean }> = {
  login: { base: 5, streakEligible: false },
  explore_topic: { base: 10, streakEligible: false },
  complete_challenge: { base: 20, streakEligible: false },
  task_done: { base: 10, streakEligible: false },
  check_in: { base: 15, streakEligible: true },
  reflection: { base: 25, streakEligible: true },
  create_project: { base: 20, streakEligible: false },
};

/** A badge that was unlocked by this award. */
export interface NewBadge {
  id: string;
  name: string;
  icon: string;
  points: number;
}

export interface AwardResult {
  points_awarded: number;
  streak_bonus: boolean;
  new_streak: number;
  new_badges: NewBadge[];
}

/** YYYY-MM-DD of the day before a given YYYY-MM-DD (UTC-safe, avoids local-TZ drift). */
function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive-day streaks computed from persisted activity dates (descending).
 *
 * `current`: walk backwards from the latest active day (today, or yesterday when
 * today is not yet active — a streak survives a single missed day).
 * `longest`: sort dates ascending and count the longest consecutive run.
 */
function computeStreak(userId: string): { current: number; longest: number } {
  const recentDates = getRecentDates(userId, 100);
  if (recentDates.length === 0) return { current: 0, longest: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = dayBefore(today);

  const dateSet = new Set(recentDates);
  const latest = recentDates[0];

  let current = 0;
  if (latest === today || latest === yesterday) {
    const startDate = latest === today ? today : yesterday;
    let cursor = startDate;
    while (dateSet.has(cursor)) {
      current++;
      cursor = dayBefore(cursor);
    }
  }

  let longest = 0;
  let run = 0;
  const sorted = [...recentDates].sort(); // YYYY-MM-DD sorts chronologically (ascending)
  for (const d of sorted) {
    run = dateSet.has(dayBefore(d)) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return { current, longest };
}

/**
 * Evaluate every locked badge against its unlock rule and unlock the ones now
 * satisfied, returning the newly unlocked badges (with their bonus point value).
 * Runs automatically after each award, but also exported for manual re-checks.
 */
export function checkBadges(userId: string): NewBadge[] {
  const allDefs = getAllBadgeDefs();
  const unlockedIds = getUnlockedBadgeIds(userId);
  const newBadges: NewBadge[] = [];

  for (const def of allDefs) {
    if (unlockedIds.has(def.id)) continue;

    const rule: UnlockRule = JSON.parse(def.unlock_rule);
    let satisfied = false;

    switch (rule.type) {
      case "action_count": {
        const cnt = getActionCount(userId, rule.subject as ActionType);
        satisfied = cnt >= rule.threshold;
        break;
      }
      case "streak_days": {
        const { longest } = computeStreak(userId);
        satisfied = longest >= rule.threshold;
        break;
      }
      case "total_points": {
        const account = getOrCreateAccount();
        satisfied = account.total_points >= rule.threshold;
        break;
      }
      case "projects_count": {
        const db = getDb();
        const row = db.prepare("SELECT COUNT(*) as cnt FROM projects").get() as { cnt: number };
        satisfied = row.cnt >= rule.threshold;
        break;
      }
      case "reflections_count": {
        const db = getDb();
        const row = db.prepare("SELECT COUNT(*) as cnt FROM reflections").get() as { cnt: number };
        satisfied = row.cnt >= rule.threshold;
        break;
      }
    }

    if (satisfied) {
      unlockBadge(userId, def.id);
      newBadges.push({ id: def.id, name: def.name, icon: def.icon, points: def.points_value });
    }
  }

  return newBadges;
}

/**
 * Award points for a completed action: enforces the daily cap, applies the
 * streak multiplier (≥7 consecutive days ×1.5) to streak-eligible actions,
 * persists the activity, updates account streak/points, then auto-unlocks any
 * badges that became eligible and adds their bonus points.
 */
export function awardPoints(userId: string, actionType: ActionType, actionTarget?: string): AwardResult {
  // 1. Daily cap: no points once the per-day limit for this action is reached
  const todayCount = countActionToday(userId, actionType);
  if (todayCount >= DAILY_CAPS[actionType]) {
    return { points_awarded: 0, streak_bonus: false, new_streak: 0, new_badges: [] };
  }

  // 2. Compute the streak, including today's pending activity:
  //    this is the day's first activity, so the streak extends or resets today.
  const recentDates = getRecentDates(userId, 100);
  const today = new Date().toISOString().slice(0, 10);
  const hasActivityToday = recentDates[0] === today;

  const { current, longest } = computeStreak(userId);

  let newCurrent = current;
  if (!hasActivityToday) {
    const yesterday = dayBefore(today);
    newCurrent = recentDates[0] === yesterday ? current + 1 : 1;
  }
  const newLongest = Math.max(longest, newCurrent);

  // 3. Apply the streak multiplier to the base points
  const rule = POINTS_RULES[actionType];
  let points = rule.base;
  let streakBonus = false;
  if (rule.streakEligible && newCurrent >= 7) {
    points = Math.round(points * 1.5);
    streakBonus = true;
  }

  // 4. Persist the activity with the final point value
  createActivity({
    user_id: userId,
    action_type: actionType,
    action_target: actionTarget,
    points,
    note: streakBonus ? `连击加成 ×1.5 (连击${newCurrent}天)` : undefined,
  });

  // 5. Update account totals (badges checked after, so they see today + this award)
  const account = getOrCreateAccount();
  const newTotal = account.total_points + points;
  updateAccountStats(account.id, {
    total_points: newTotal,
    current_streak: newCurrent,
    longest_streak: newLongest,
  });

  // 6. Auto-unlock badges and award their bonus points
  const newBadges = checkBadges(userId);
  let badgePoints = 0;
  for (const b of newBadges) {
    badgePoints += b.points;
  }
  if (badgePoints > 0) {
    updateAccountStats(account.id, {
      total_points: newTotal + badgePoints,
      current_streak: newCurrent,
      longest_streak: newLongest,
    });
  }

  return {
    points_awarded: points + badgePoints,
    streak_bonus: streakBonus,
    new_streak: newCurrent,
    new_badges: newBadges,
  };
}
