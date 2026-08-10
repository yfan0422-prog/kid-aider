"use client";

import { useChatStore } from "@/lib/store/chat-store";
import { useLocale } from "@/lib/i18n/context";
import { FunnelView } from "./funnel-view";
import { SolutionPreview } from "./solution-preview";

export function SidePanel() {
  const { t } = useLocale();
  const sidePanelOpen = useChatStore((s) => s.sidePanelOpen);
  const setSidePanelOpen = useChatStore((s) => s.setSidePanelOpen);

  if (!sidePanelOpen) {
    return (
      <button
        onClick={() => setSidePanelOpen(true)}
        className="fixed right-4 top-4 z-50 bg-surface border border-border rounded-xl p-2 shadow-md hover:shadow-lg transition-shadow"
        title={t("panel.open")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3z M3 9h18 M9 3v18" />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-[320px] h-full bg-surface border-l border-border flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-bold text-ink-secondary uppercase tracking-wider">
          {t("panel.title")}
        </h2>
        <button
          onClick={() => setSidePanelOpen(false)}
          className="text-ink-tertiary hover:text-ink p-1 rounded-lg hover:bg-surface-raised transition-colors"
          title={t("common.close")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <FunnelView />
      <SolutionPreview />
    </div>
  );
}
