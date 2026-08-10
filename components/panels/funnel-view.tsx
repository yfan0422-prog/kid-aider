"use client";

import { useChatStore } from "@/lib/store/chat-store";
import { useLocale } from "@/lib/i18n/context";
import type { RequirementNode } from "@/lib/utils/types";
import { FunnelNode } from "./funnel-node";

export function FunnelView() {
  const { t } = useLocale();
  const funnelNodes = useChatStore((s) => s.funnelNodes);
  const funnelComplete = useChatStore((s) => s.funnelComplete);

  // Always show 5 layers; create placeholder nodes for empty ones
  const displayNodes: RequirementNode[] = Array.from({ length: 5 }, (_, i) => {
    const layer = (i + 1) as RequirementNode["layer"];
    const existing = funnelNodes.find((n) => n.layer === layer);
    return existing || {
      id: `placeholder-${layer}`,
      session_id: "",
      layer,
      label: "",
      content: "",
      parent_id: null,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    };
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-ink-secondary uppercase tracking-wider">
          {t("funnel.tree.title")}
        </h3>
        {funnelComplete && (
          <span className="badge-achievement inline-flex items-center gap-1 bg-brand-soft text-[#B26A00] rounded-full px-3 py-1 text-xs font-semibold">
            {t("funnel.badge.done")}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {displayNodes.map((node, i) => (
          <FunnelNode
            key={node.id}
            node={node}
            isActive={!node.content && (i === 0 || Boolean(displayNodes[i - 1]?.content))}
          />
        ))}
      </div>
    </div>
  );
}
