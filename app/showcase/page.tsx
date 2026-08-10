"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";
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
  const { t } = useLocale();
  const [projects, setProjects] = useState<ShowcaseProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/showcase")
      .then(r => r.json())
      .then(data => {
        // Load featured from localStorage
        let featured: string[] = [];
        try {
          featured = JSON.parse(localStorage.getItem("showcase-featured") || "[]");
        } catch { /* ignore */ }

        const mapped: ShowcaseProject[] = (data.projects || []).map(
          (p: { id: string; title: string; days: number; tasksDone: number; badges: Array<{ icon: string; label: string }> }) => ({
            id: p.id,
            title: p.title,
            days: p.days,
            tasksDone: p.tasksDone,
            badges: p.badges,
            isFeatured: featured.includes(p.id),
          })
        );
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
          {t("showcase.back")}
        </Link>
        <h1 className="text-2xl font-bold">🌟 {t("showcase.title")}</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-20">
          <p className="text-ink-tertiary text-body-lg mb-2">{t("showcase.empty")}</p>
          <p className="text-ink-tertiary text-body-sm">
            {t("showcase.empty.tip")}
          </p>
          <Link
            href="/projects"
            className="inline-block mt-4 text-primary hover:underline"
          >
            {t("showcase.empty.go_projects")}
          </Link>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="space-y-6">
          {/* Featured section */}
          {featuredProjects.length > 0 && (
            <section>
              <h2 className="text-body-lg font-bold text-ink mb-3">{t("showcase.featured")}</h2>
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
              {featuredProjects.length > 0 ? t("showcase.all") : ""}
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
