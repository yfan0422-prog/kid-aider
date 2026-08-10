"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";
import { UsageControl } from "@/components/parent/usage-control";
import { FilteredWordsManager } from "@/components/parent/filtered-words-manager";
import { ProjectManager } from "@/components/parent/project-manager";
import { ProfileView } from "@/components/parent/profile-view";
import { TopicManager } from "@/components/parent/topic-manager";
import { DataPanel } from "@/components/parent/data-panel";
import { SystemLog } from "@/components/parent/system-log";
import { ModelProfileList } from "@/components/settings/model-profile-list";
import type { UsageConfig } from "@/lib/utils/types";

type Tab = "control" | "models" | "projects" | "profile" | "content" | "data" | "logs";

export default function ParentPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("control");
  const [config, setConfig] = useState<UsageConfig | null>(null);

  useEffect(() => {
    fetch("/api/usage/config")
      .then(r => r.json())
      .then(d => setConfig(d.config));
  }, []);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "control", label: t("parent.tab.usage"), icon: "🔧" },
    { key: "models", label: t("parent.tab.models"), icon: "🤖" },
    { key: "projects", label: t("parent.tab.projects"), icon: "📁" },
    { key: "profile", label: t("parent.tab.profile"), icon: "🧠" },
    { key: "content", label: t("parent.tab.content"), icon: "📰" },
    { key: "data", label: t("parent.tab.data"), icon: "📊" },
    { key: "logs", label: t("parent.tab.logs"), icon: "📋" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          {t("parent.back")}
        </Link>
        <h1 className="text-2xl font-bold">👨‍👩‍👧 {t("parent.title")}</h1>
      </div>

      {/* Restrictions toggle */}
      {config && (
        <div className="flex items-center gap-3 mb-6 p-3 bg-surface border border-border rounded-card">
          <span className="text-lg">{config.restrictions_paused ? "🔓" : "🔒"}</span>
          <span className="text-body-sm font-semibold">
            {config.restrictions_paused ? t("parent.restrictions.paused") : t("parent.restrictions.active")}
          </span>
          <button
            onClick={async () => {
              const res = await fetch("/api/usage/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restrictions_paused: config.restrictions_paused ? 0 : 1 }),
              });
              const d = await res.json();
              setConfig(d.config);
            }}
            className="ml-auto text-body-sm text-primary hover:underline"
          >
            {config.restrictions_paused ? t("parent.restrictions.resume") : t("parent.restrictions.pause")}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 mb-6 border-b border-border">
        {tabs.map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-body-sm border-b-2 transition-colors ${
              tab === tabItem.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-ink-tertiary hover:text-ink"
            }`}
          >
            {tabItem.icon} {tabItem.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "control" && (
        <div className="space-y-6">
          <UsageControl config={config} onConfigChange={setConfig} />
          <section className="bg-surface border border-border rounded-card p-5">
            <h2 className="text-body-lg font-bold mb-3">🚫 {t("parent.tab.filter")}</h2>
            <FilteredWordsManager />
          </section>
        </div>
      )}
      {tab === "models" && (
        <section className="bg-surface border border-border rounded-card p-5">
          <ModelProfileList />
        </section>
      )}
      {tab === "projects" && <ProjectManager />}
      {tab === "profile" && <ProfileView />}
      {tab === "content" && <TopicManager />}
      {tab === "data" && <DataPanel />}
      {tab === "logs" && <SystemLog />}
    </div>
  );
}
