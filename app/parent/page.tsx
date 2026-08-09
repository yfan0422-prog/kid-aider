"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UsageControl } from "@/components/parent/usage-control";
import type { UsageConfig } from "@/lib/utils/types";

type Tab = "control" | "projects" | "data" | "logs";

export default function ParentPage() {
  const [tab, setTab] = useState<Tab>("control");
  const [config, setConfig] = useState<UsageConfig | null>(null);

  useEffect(() => {
    fetch("/api/usage/config")
      .then(r => r.json())
      .then(d => setConfig(d.config));
  }, []);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "control", label: "控制", icon: "🔧" },
    { key: "projects", label: "项目", icon: "📁" },
    { key: "data", label: "数据", icon: "📊" },
    { key: "logs", label: "日志", icon: "📋" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">👨‍👩‍👧 家长控制</h1>
      </div>

      {/* Restrictions toggle */}
      {config && (
        <div className="flex items-center gap-3 mb-6 p-3 bg-surface border border-border rounded-card">
          <span className="text-lg">{config.restrictions_paused ? "🔓" : "🔒"}</span>
          <span className="text-body-sm font-semibold">
            {config.restrictions_paused ? "限制已暂停" : "限制已开启"}
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
            {config.restrictions_paused ? "恢复限制" : "暂停限制"}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 mb-6 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-body-sm border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-ink-tertiary hover:text-ink"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "control" && <UsageControl config={config} onConfigChange={setConfig} />}
      {tab === "projects" && <p className="text-ink-tertiary text-body-sm">项目管理 — 待 Task 9 实现</p>}
      {tab === "data" && <p className="text-ink-tertiary text-body-sm">数据面板 — 待 Task 10 实现</p>}
      {tab === "logs" && <p className="text-ink-tertiary text-body-sm">系统日志 — 待 Task 10 实现</p>}
    </div>
  );
}
