import { create } from "zustand";
import type { Project, Track, CheckIn, Reflection } from "@/lib/utils/types";

interface ProjectState {
  projects: Project[];
  currentProject: (Project & { tracks: Track[] }) | null;
  checkIns: CheckIn[];
  reflections: Reflection[];
  streak: { current: number; longest: number };

  // Actions
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (p: (Project & { tracks: Track[] }) | null) => void;
  setCheckIns: (c: CheckIn[]) => void;
  setReflections: (r: Reflection[]) => void;
  setStreak: (s: { current: number; longest: number }) => void;
  updateTaskStatus: (taskId: string, status: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  checkIns: [],
  reflections: [],
  streak: { current: 0, longest: 0 },

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (p) => set({ currentProject: p }),
  setCheckIns: (c) => set({ checkIns: c }),
  setReflections: (r) => set({ reflections: r }),
  setStreak: (s) => set({ streak: s }),

  updateTaskStatus: (taskId, status) =>
    set((s) => {
      if (!s.currentProject) return s;
      return {
        currentProject: {
          ...s.currentProject,
          tracks: s.currentProject.tracks.map((t) => ({
            ...t,
            milestones: (t as Track & { milestones: Array<{ id: string; tasks: Array<{ id: string; status: string }> }> }).milestones.map((m) => ({
              ...m,
              tasks: m.tasks.map((tk) =>
                tk.id === taskId ? { ...tk, status } : tk
              ),
            })),
          })),
        },
      };
    }),
}));
