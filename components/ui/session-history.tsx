"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChild } from "@/components/ui/child-provider";
import { useLocale } from "@/lib/i18n/context";
import { useChatStore } from "@/lib/store/chat-store";

interface HistorySession {
  id: string;
  title: string;
  updated_at: string;
  preview: string;
}

function formatTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(locale, { month: "numeric", day: "numeric" });
}

export function SessionHistory() {
  const { t, locale } = useLocale();
  const { childId } = useChild();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async () => {
    if (!childId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?child_id=${encodeURIComponent(childId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // 静默保留上次列表
    } finally {
      setLoading(false);
    }
  }, [childId]);

  const toggle = () => {
    if (!open) {
      load();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const resume = (id: string) => {
    setOpen(false);
    // 清空当前会话状态，再加载目标会话
    useChatStore.getState().reset();
    router.push(`/?session=${id}&child_id=${encodeURIComponent(childId || "")}`);
  };

  const newChat = () => {
    setOpen(false);
    useChatStore.getState().reset();
    router.push(`/?child_id=${encodeURIComponent(childId || "")}`);
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("history.delete_confirm"))) return;
    try {
      const res = await fetch(
        `/api/sessions/${id}?child_id=${encodeURIComponent(childId || "")}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      setSessions((prev) => prev.filter((s) => s.id !== id));
      // 若删除的是当前正在查看的会话，清空聊天界面
      if (useChatStore.getState().sessionId === id) {
        useChatStore.getState().reset();
        router.replace(`/?child_id=${encodeURIComponent(childId || "")}`);
      }
    } catch {
      // 删除失败静默保留列表
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-body-sm text-ink-secondary hover:text-primary transition-colors px-2 py-1 rounded-btn hover:bg-surface-raised"
        title={t("nav.history")}
      >
        <span>🕘</span>
        <span>{t("nav.history")}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-card shadow-lg min-w-[280px] max-w-[320px] z-50 flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-body-sm font-bold text-ink">{t("history.title")}</span>
            <button
              onClick={newChat}
              className="text-body-xs text-primary hover:opacity-80 transition-opacity"
            >
              ＋ {t("history.new")}
            </button>
          </div>

          <div className="overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-body-sm text-ink-tertiary">
                {t("common.loading")}
              </p>
            ) : sessions.length === 0 ? (
              <p className="px-3 py-6 text-center text-body-sm text-ink-tertiary">
                {t("history.empty")}
              </p>
            ) : (
              sessions.map((s) => {
                const label = s.title || s.preview || t("history.untitled");
                const time = formatTime(s.updated_at, locale);
                return (
                  <div
                    key={s.id}
                    className="flex items-center border-b border-border/60 last:border-b-0 hover:bg-surface-raised transition-colors"
                  >
                    <button
                      onClick={() => resume(s.id)}
                      className="flex-1 min-w-0 text-left px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-sm text-ink font-medium truncate">{label}</span>
                        {time && <span className="text-caption text-ink-tertiary shrink-0">{time}</span>}
                      </div>
                      {s.preview && (
                        <p className="text-caption text-ink-tertiary truncate mt-0.5">{s.preview}</p>
                      )}
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      title={t("history.delete")}
                      aria-label={t("history.delete")}
                      className="shrink-0 px-2.5 py-2 text-ink-tertiary hover:text-red-500 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6h14z" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
