"use client";

import { useState } from "react";
import type { UsageConfig } from "@/lib/utils/types";

interface Props {
  config: UsageConfig | null;
  onConfigChange: (c: UsageConfig) => void;
}

const DURATION_OPTIONS = [30, 60, 90, 120, 0]; // 0 = unlimited

export function UsageControl({ config, onConfigChange }: Props) {
  const [saving, setSaving] = useState(false);

  if (!config) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const update = async (attrs: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch("/api/usage/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attrs),
    });
    const d = await res.json();
    onConfigChange(d.config);
    setSaving(false);
  };

  const currentLimit = config.daily_limit_min || 0;

  return (
    <div className="space-y-6">
      {/* Daily limit */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">⏱ 每日使用时长</h2>
        <div className="flex items-center gap-2 mb-2">
          {DURATION_OPTIONS.map(min => (
            <button
              key={min}
              onClick={() => update({ daily_limit_min: min === 0 ? null : min })}
              disabled={saving}
              className={`px-3 py-1.5 text-body-sm rounded-btn border transition-colors ${
                currentLimit === min
                  ? "border-primary bg-primary/5 text-primary font-semibold"
                  : "border-border text-ink-tertiary hover:text-ink"
              }`}
            >
              {min === 0 ? "不限" : `${min} 分钟`}
            </button>
          ))}
        </div>
        <p className="text-body-sm text-ink-tertiary">
          到达限制后将温和提示，不强制锁屏
        </p>
      </section>

      {/* Quiet hours */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🌙 免打扰时段</h2>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={config.quiet_start || ""}
            onChange={e => update({ quiet_start: e.target.value || null })}
            disabled={saving}
            className="border border-border rounded-btn px-3 py-1.5 text-body-sm"
          />
          <span className="text-ink-tertiary text-body-sm">至</span>
          <input
            type="time"
            value={config.quiet_end || ""}
            onChange={e => update({ quiet_end: e.target.value || null })}
            disabled={saving}
            className="border border-border rounded-btn px-3 py-1.5 text-body-sm"
          />
        </div>
        <p className="text-body-sm text-ink-tertiary mt-2">
          时段内阻止新会话，不打断进行中的对话
        </p>
      </section>

      {/* Content filter toggle */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🛡 内容过滤</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => update({ filter_enabled: config.filter_enabled ? 0 : 1 })}
            disabled={saving}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.filter_enabled ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.filter_enabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-body-sm font-semibold">
            {config.filter_enabled ? "已开启" : "已关闭"}
          </span>
        </div>
        <p className="text-body-sm text-ink-tertiary mt-2">
          AI 输出命中敏感词时替换为安全提示
        </p>
      </section>
    </div>
  );
}
