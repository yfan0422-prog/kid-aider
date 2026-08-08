"use client";

import Link from "next/link";
import type { Project } from "@/lib/utils/types";

interface Props {
  project: Project;
}

export function ProjectCard({ project }: Props) {
  const statusLabel =
    project.status === "active" ? "进行中" :
    project.status === "paused" ? "已暂停" : "已完成";
  const statusColor =
    project.status === "active" ? "bg-accent-green/10 text-accent-green" :
    project.status === "paused" ? "bg-brand-soft text-[#B26A00]" :
    "bg-surface-raised text-ink-tertiary";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block bg-surface border border-border rounded-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-body-lg">{project.title}</h3>
        <span className={`text-xs rounded-full px-2.5 py-1 font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-center gap-2 text-body-sm text-ink-tertiary">
        <span>上次活动：{new Date(project.updated_at).toLocaleDateString("zh-CN")}</span>
      </div>
    </Link>
  );
}
