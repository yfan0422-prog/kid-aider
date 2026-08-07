"use client";

import type { RequirementNode } from "@/lib/utils/types";

const LAYER_LABELS: Record<number, string> = {
  1: "愿望",
  2: "对象",
  3: "功能",
  4: "约束",
  5: "验收",
};

const LAYER_COLORS: Record<number, string> = {
  1: "border-l-primary bg-blue-50/50",
  2: "border-l-accent-purple bg-purple-50/30",
  3: "border-l-brand bg-orange-50/30",
  4: "border-l-accent-yellow bg-yellow-50/30",
  5: "border-l-accent-green bg-green-50/30",
};

interface Props {
  node: RequirementNode;
  isActive: boolean;
}

export function FunnelNode({ node, isActive }: Props) {
  return (
    <div
      className={`card border-l-[5px] rounded-2xl p-4 transition-all ${
        LAYER_COLORS[node.layer] || "border-l-primary"
      } ${isActive ? "ring-2 ring-primary ring-offset-2" : ""} ${
        node.content ? "opacity-100" : "opacity-40"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-bold text-ink-tertiary bg-surface-raised px-2 py-0.5 rounded-full">
          第{node.layer}层
        </span>
        <span className="text-sm font-semibold text-ink">
          {LAYER_LABELS[node.layer] || node.label}
        </span>
        {node.content && (
          <span className="text-xs text-accent-green ml-auto">✓</span>
        )}
      </div>
      {node.content ? (
        <p className="text-body-sm text-ink-secondary">{node.content}</p>
      ) : (
        <p className="text-body-sm text-ink-tertiary italic">等待中……</p>
      )}
    </div>
  );
}
