"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChatView } from "@/components/chat/chat-view";
import { SidePanel } from "@/components/panels/side-panel";
import { ChildSwitcher } from "@/components/ui/child-switcher";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { useChild } from "@/components/ui/child-provider";
import { useChatStore } from "@/lib/store/chat-store";
import { useLocale } from "@/lib/i18n/context";

/** Hydrates the chat store from ?session= URL param so seed messages appear. */
function SessionLoader() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");

  useEffect(() => {
    if (!sessionParam) return;

    fetch(`/api/sessions/${sessionParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.session) {
          useChatStore.getState().setSessionId(data.session.id);
          useChatStore.getState().setAgeGroup(data.session.age_group);
        }
        if (data.messages) {
          useChatStore.getState().setMessages(data.messages);
        }
      })
      .catch(() => {});
  }, [sessionParam]);

  return null;
}

/** 路由守卫 — 无 childId 时跳转到孩子选择页；URL 带 child_id 时同步到 state。 */
function ChildGuard() {
  const { childId, setChildId, loading } = useChild();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading) return;
    const urlChildId = searchParams.get("child_id");
    if (urlChildId) {
      if (childId !== urlChildId) {
        setChildId(urlChildId);
      }
    } else if (!childId) {
      router.replace("/select");
    }
  }, [childId, loading, router, searchParams, setChildId]);

  return null;
}

export default function Home() {
  const { t } = useLocale();
  return (
    <>
      <Suspense fallback={null}>
        <SessionLoader />
        <ChildGuard />
      </Suspense>
      <div className="flex flex-col h-screen">
      {/* Top nav bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-white/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧒</span>
          <h1 className="text-body-lg font-bold text-ink">Kid-Aider</h1>
          <ChildSwitcher />
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/me"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            {t("nav.me")}
          </Link>
          <Link
            href="/explore"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            {t("nav.explore")}
          </Link>
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            {t("nav.projects")}
          </Link>
          <Link
            href="/growth"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            {t("nav.growth")}
          </Link>
          <Link
            href="/showcase"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            {t("nav.showcase")}
          </Link>
          <Link
            href="/report"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            {t("nav.report")}
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            {t("nav.settings")}
          </Link>
          <LocaleSwitcher />
        </div>
      </header>
      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <ChatView />
        </div>
        <SidePanel />
      </div>
      </div>
    </>
  );
}
