"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/context";

interface LogData {
  usage_summary: {
    total_hours: number;
    active_days: number;
    avg_min_per_day: number;
  };
  recent_logs: Array<{
    id: string; action: string; detail: string; created_at: string; project_title: string;
  }>;
  recent_ai_calls: Array<{
    id: string; role: string; created_at: string;
  }>;
}

export function SystemLog() {
  const { t, locale } = useLocale();
  const ACTION_LABELS: Record<string, string> = {
    task_done: `✅ ${t("project.log.task_done")}`, task_undo: `↩️ ${t("parent.logs.action.task_undo")}`,
    check_in: `📅 ${t("project.log.check_in")}`, reflection: `💭 ${t("project.log.reflection")}`,
    project_complete: `🎉 ${t("parent.logs.action.project_complete")}`, project_resume: `🔄 ${t("parent.logs.action.project_resume")}`,
    project_create: `🆕 ${t("parent.logs.action.project_create")}`,
  };
  const [data, setData] = useState<LogData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/parent/logs")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-ink-tertiary text-body-sm text-center py-8">{t("common.load_failed")}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Usage summary */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📊 {t("parent.logs.summary")}</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{data.usage_summary.total_hours}</p>
            <p className="text-body-sm text-ink-tertiary">{t("parent.logs.total_hours")}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{data.usage_summary.active_days}</p>
            <p className="text-body-sm text-ink-tertiary">{t("parent.logs.active_days")}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{data.usage_summary.avg_min_per_day}</p>
            <p className="text-body-sm text-ink-tertiary">{t("parent.logs.avg_minutes")}</p>
          </div>
        </div>
      </section>

      {/* Recent operation logs */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">📋 {t("parent.logs.recent_ops")}</h2>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {data.recent_logs.map(log => (
            <div key={log.id} className="flex items-center gap-2 text-body-sm">
              <span className="text-ink-tertiary w-32 shrink-0">
                {new Date(log.created_at).toLocaleString(locale)}
              </span>
              <span>{ACTION_LABELS[log.action] || log.action}</span>
              <span className="text-ink-tertiary">{log.detail}</span>
              <span className="text-ink-tertiary text-xs">({log.project_title})</span>
            </div>
          ))}
          {data.recent_logs.length === 0 && (
            <p className="text-ink-tertiary text-body-sm text-center py-4">{t("parent.logs.no_ops")}</p>
          )}
        </div>
      </section>

      {/* Recent AI calls */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-body-lg font-bold mb-3">🤖 {t("parent.logs.recent_ai")}</h2>
        <div className="space-y-1.5">
          {data.recent_ai_calls.map(call => (
            <div key={call.id} className="text-body-sm text-ink-tertiary">
              {new Date(call.created_at).toLocaleString(locale)} — {call.role}
            </div>
          ))}
          {data.recent_ai_calls.length === 0 && (
            <p className="text-ink-tertiary text-body-sm text-center py-4">{t("parent.logs.no_ai_calls")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
