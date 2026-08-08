"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProjectShowcaseCard } from "@/components/showcase/project-showcase-card";

interface ShowcaseProject {
  id: string;
  title: string;
  days: number;
  tasksDone: number;
  badges: Array<{ icon: string; label: string }>;
  isFeatured: boolean;
}

export default function ShowcasePage() {
  const [projects, setProjects] = useState<ShowcaseProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(data => {
        const completed = (data.projects || []).filter(
          (p: { status: string }) => p.status === "completed"
        );
        // Load featured from localStorage
        let featured: string[] = [];
        try {
          featured = JSON.parse(localStorage.getItem("showcase-featured") || "[]");
        } catch { /* ignore */ }

        const mapped: ShowcaseProject[] = completed.map((p: { id: string; title: string }) => ({
          id: p.id,
          title: p.title,
          days: 0, // Will be populated by detail fetch — acceptable simplification
          tasksDone: 0,
          badges: [],
          isFeatured: featured.includes(p.id),
        }));
        setProjects(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleFeatured = (id: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== id) return p;
        const newFeatured = !p.isFeatured;
        // Update localStorage
        try {
          let featured: string[] = JSON.parse(localStorage.getItem("showcase-featured") || "[]");
          if (newFeatured) {
            if (featured.length >= 2) return p; // Max 2
            featured.push(id);
          } else {
            featured = featured.filter((f: string) => f !== id);
          }
          localStorage.setItem("showcase-featured", JSON.stringify(featured));
        } catch { /* ignore */ }
        return { ...p, isFeatured: newFeatured };
      });
      return updated;
    });
  };

  const featuredProjects = projects.filter(p => p.isFeatured);
  const regularProjects = projects.filter(p => !p.isFeatured);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">🌟 我的作品墙</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-20">
          <p className="text-ink-tertiary text-body-lg mb-2">还没有完成的项目</p>
          <p className="text-ink-tertiary text-body-sm">
            完成一个项目后，它会出现在这里！
          </p>
          <Link
            href="/projects"
            className="inline-block mt-4 text-primary hover:underline"
          >
            去看看我的项目 →
          </Link>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="space-y-6">
          {/* Featured section */}
          {featuredProjects.length > 0 && (
            <section>
              <h2 className="text-body-lg font-bold text-ink mb-3">★ 精选作品</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuredProjects.map(p => (
                  <ProjectShowcaseCard
                    key={p.id}
                    project={p}
                    onToggleFeatured={toggleFeatured}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All projects */}
          <section>
            <h2 className="text-body-lg font-bold text-ink mb-3">
              {featuredProjects.length > 0 ? "全部作品" : ""}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regularProjects.map(p => (
                <ProjectShowcaseCard
                  key={p.id}
                  project={p}
                  onToggleFeatured={toggleFeatured}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
