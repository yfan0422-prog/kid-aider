import { create } from "zustand";

interface SnapshotMap {
  [dimension: string]: { score: number; score_type: string; evidence: string };
}

interface TrendPoint {
  week_start: string;
  scores: Record<string, number>;
}

interface BadgeItem {
  id: string;
  name: string;
  label: string;
  tier: string;
  dimension: string | null;
  category: string;
  description: string;
  icon: string;
  earned_at: string | null;
}

interface ReportSummary {
  total_projects: number;
  completed_projects: number;
  total_tasks: number;
  total_tasks_done: number;
  task_completion_rate: number;
  badges_earned: number;
  current_streak: number;
}

interface NewBadge {
  id: string;
  label: string;
  icon: string;
}

interface GrowthState {
  snapshots: SnapshotMap;
  badges: BadgeItem[];
  trends: TrendPoint[];
  newBadges: NewBadge[];
  summary: ReportSummary | null;
  loading: boolean;

  fetchGrowthData: () => Promise<void>;
  triggerSnapshot: () => Promise<void>;
  clearNewBadges: () => void;
}

export const useGrowthStore = create<GrowthState>((set) => ({
  snapshots: {},
  badges: [],
  trends: [],
  newBadges: [],
  summary: null,
  loading: false,

  fetchGrowthData: async () => {
    set({ loading: true });
    try {
      const [compRes, badgeRes] = await Promise.all([
        fetch("/api/competency"),
        fetch("/api/badges"),
      ]);
      const compData = await compRes.json();
      const badgeData = await badgeRes.json();

      set({
        snapshots: compData.snapshots || {},
        trends: compData.trends || [],
        badges: badgeData.badges || [],
      });
    } catch (e) {
      console.error("Failed to fetch growth data", e);
    } finally {
      set({ loading: false });
    }
  },

  triggerSnapshot: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/competency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snapshot" }),
      });
      const data = await res.json();

      if (data.snapshots && Object.keys(data.snapshots).length > 0) {
        set({ snapshots: data.snapshots });
      }

      if (data.new_badges?.length > 0) {
        set({ newBadges: data.new_badges });
      }
    } catch (e) {
      console.error("Failed to trigger snapshot", e);
    } finally {
      set({ loading: false });
    }
  },

  clearNewBadges: () => set({ newBadges: [] }),
}));
