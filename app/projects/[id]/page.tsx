"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";
import { ProjectHero } from "@/components/projects/project-hero";
import { TrackColumn } from "@/components/projects/track-column";
import { CalendarHeatmap } from "@/components/projects/calendar-heatmap";
import { StreakBadge } from "@/components/projects/streak-badge";
import { CheckInDialog } from "@/components/projects/check-in-dialog";
import { ReflectionDialog } from "@/components/projects/reflection-dialog";
import type { CheckIn, ReflectionType } from "@/lib/utils/types";
import { useChatStore } from "@/lib/store/chat-store";

interface ProjectData {
  id: string;
  title: string;
  status: string;
  tracks: Array<{
    id: string;
    name: string;
    type: string;
    milestones: Array<{
      id: string;
      title: string;
      status: string;
      tasks: Array<{
        id: string;
        title: string;
        what_to_do: string;
        how_hint: string;
        difficulty: number;
        status: string;
      }>;
    }>;
  }>;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLocale();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const ageGroup = useChatStore(s => s.ageGroup);

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionType, setReflectionType] = useState<ReflectionType>("daily");

  const fetchCheckIns = () => {
    fetch(`/api/projects/${id}/check-in`)
      .then(r => r.json())
      .then(d => {
        setCheckIns(d.check_ins || []);
        setStreak(d.streak || { current: 0, longest: 0 });
      })
      .catch(console.error);
  };

  const fetchProject = () => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(d => setProject(d.project))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProject(); }, [id]);
  useEffect(() => { fetchCheckIns(); }, [id]);

  const handleTaskToggle = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}/done`, { method: "POST" });
    const data = await res.json();
    if (data.task) {
      // Optimistic update: toggle locally
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tracks: prev.tracks.map(t => ({
            ...t,
            milestones: t.milestones.map(m => ({
              ...m,
              tasks: m.tasks.map(tk =>
                tk.id === taskId ? { ...tk, status: data.task.status } : tk
              ),
            })),
          })),
        };
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-body-lg text-ink-tertiary">{t("error.project_not_found")}</p>
        <Link href="/projects" className="text-primary hover:underline mt-4 inline-block">{t("project.detail.back")}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects" className="text-ink-tertiary hover:text-ink transition-colors">
          {t("project.detail.back")}
        </Link>
        <h1 className="text-2xl font-bold">{project.title}</h1>
      </div>

      <ProjectHero projectId={id} ageGroup={ageGroup} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {project.tracks.map(t => (
          <TrackColumn key={t.id} track={t} onTaskToggle={handleTaskToggle} />
        ))}
      </div>

      {/* Check-in & Reflection bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowCheckIn(true)}
          className="bg-primary text-white border-none rounded-btn px-4 py-2 font-semibold text-body-sm"
        >
          {t("project.detail.checkin")}
        </button>
        <button
          onClick={() => { setReflectionType("daily"); setShowReflection(true); }}
          className="bg-surface border border-border rounded-btn px-4 py-2 font-medium text-body-sm hover:bg-surface-raised transition-colors"
        >
          {t("project.detail.reflection.daily")}
        </button>
        <button
          onClick={() => { setReflectionType("milestone"); setShowReflection(true); }}
          className="bg-surface border border-border rounded-btn px-4 py-2 font-medium text-body-sm hover:bg-surface-raised transition-colors"
        >
          {t("project.detail.reflection.milestone")}
        </button>
        <button
          onClick={() => { setReflectionType("final"); setShowReflection(true); }}
          className="bg-surface border border-border rounded-btn px-4 py-2 font-medium text-body-sm hover:bg-surface-raised transition-colors"
        >
          {t("project.detail.reflection.final")}
        </button>
      </div>

      {/* Calendar and streak */}
      <div className="mt-6 bg-surface border border-border rounded-card p-5">
        <h3 className="font-semibold text-body mb-3">{t("project.detail.checkin.history")}</h3>
        <CalendarHeatmap checkIns={checkIns} />
        <div className="mt-3">
          <StreakBadge current={streak.current} longest={streak.longest} />
        </div>
      </div>

      {/* Dialogs */}
      {showCheckIn && (
        <CheckInDialog
          projectId={id}
          onDone={() => {
            setShowCheckIn(false);
            fetchCheckIns();
          }}
          onClose={() => setShowCheckIn(false)}
        />
      )}
      {showReflection && (
        <ReflectionDialog
          projectId={id}
          type={reflectionType}
          onDone={() => {
            setShowReflection(false);
          }}
          onClose={() => setShowReflection(false)}
        />
      )}
    </div>
  );
}
