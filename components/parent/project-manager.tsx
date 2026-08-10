"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { ProjectDetailModal } from "./project-detail-modal";

interface ParentProject {
  id: string;
  title: string;
  status: string;
  tasks_total: number;
  tasks_done: number;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-600",
  paused: "text-yellow-600",
  completed: "text-blue-600",
  archived: "text-gray-400",
};

export function ProjectManager() {
  const { t, locale } = useLocale();
  const STATUS_LABELS: Record<string, string> = {
    active: t("project.status.active"),
    paused: t("project.status.paused"),
    completed: t("project.status.completed"),
    archived: t("parent.projects.status.archived"),
  };
  const [projects, setProjects] = useState<ParentProject[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchProjects = useCallback(() => {
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    fetch(`/api/parent/projects${params}`)
      .then(r => r.json())
      .then(d => setProjects(d.projects))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const changeStatus = async (id: string, status: string) => {
    await fetch(`/api/parent/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProjects();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        {["", "active", "completed", "archived"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-body-sm rounded-btn border transition-colors ${
              filter === s ? "border-primary bg-primary/5 text-primary" : "border-border text-ink-tertiary"
            }`}
          >
            {s === "" ? t("explore.all") : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <p className="text-ink-tertiary text-body-sm text-center py-8">{t("parent.projects.empty")}</p>
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <div key={p.id} className="bg-surface border border-border rounded-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-body font-bold text-ink">{p.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-body-sm text-ink-tertiary">
                    <span className={STATUS_COLORS[p.status]}>● {STATUS_LABELS[p.status]}</span>
                    <span>{t("parent.projects.tasks_progress", { done: String(p.tasks_done), total: String(p.tasks_total) })}</span>
                    <span>{new Date(p.created_at).toLocaleDateString(locale)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDetailId(p.id)}
                    className="text-body-sm text-primary hover:underline px-2"
                  >
                    {t("parent.projects.detail")}
                  </button>
                  {p.status !== "archived" ? (
                    <button
                      onClick={() => changeStatus(p.id, "archived")}
                      className="text-body-sm text-ink-tertiary hover:text-ink px-2"
                    >
                      {t("parent.projects.archive")}
                    </button>
                  ) : (
                    <button
                      onClick={() => changeStatus(p.id, "paused")}
                      className="text-body-sm text-ink-tertiary hover:text-ink px-2"
                    >
                      {t("parent.projects.restore")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detailId && (
        <ProjectDetailModal
          projectId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
