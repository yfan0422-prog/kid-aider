"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProjectHero } from "@/components/projects/project-hero";
import { TrackColumn } from "@/components/projects/track-column";
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
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const ageGroup = useChatStore(s => s.ageGroup);

  const fetchProject = () => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(d => setProject(d.project))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProject(); }, [id]);

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
        <p className="text-body-lg text-ink-tertiary">项目不存在</p>
        <Link href="/projects" className="text-primary hover:underline mt-4 inline-block">返回项目列表</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回项目列表
        </Link>
        <h1 className="text-2xl font-bold">{project.title}</h1>
      </div>

      <ProjectHero projectId={id} ageGroup={ageGroup} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {project.tracks.map(t => (
          <TrackColumn key={t.id} track={t} onTaskToggle={handleTaskToggle} />
        ))}
      </div>
    </div>
  );
}
