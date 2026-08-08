"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProjectCard } from "@/components/projects/project-card";
import type { Project } from "@/lib/utils/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">🚀 我的项目</h1>
      </div>

      {loading && (
        <div className="text-center py-12 text-ink-tertiary">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>加载中……</p>
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-body-lg text-ink-tertiary">还没有项目</p>
          <p className="text-body-sm text-ink-tertiary mt-2">
            先在首页完成一次方案包生成，然后点击&ldquo;开始项目&rdquo;即可创建
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-primary hover:underline text-body"
          >
            回到首页 →
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}
