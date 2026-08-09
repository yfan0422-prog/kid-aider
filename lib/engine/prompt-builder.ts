import type { AgeGroup } from "@/lib/utils/types";
import type { Message } from "@/lib/utils/types";
import { buildSystemPrompt } from "@/lib/prompts/system-prompt";
import { pickStrategy, formatStrategyPrompt } from "./strategy-picker";
import type { FunnelState, FunnelLayer } from "./funnel-machine";
import { getLayerQuestion, getLayerLabel } from "./funnel-machine";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildChatPrompt(opts: {
  ageGroup: AgeGroup;
  funnelStep: number;
  funnelState?: FunnelState;
  recentMessages: Message[];
  currentInput: string;
  profileContext?: string;  // ← 新增 P6
}): ChatMessage[] {
  const systemPrompt = buildSystemPrompt(opts.ageGroup, opts.funnelStep);
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // P6: 注入画像上下文（在情绪上下文之前，对终端用户不可见）
  if (opts.profileContext) {
    messages.push({ role: "system", content: opts.profileContext });
  }

  // Add recent conversation history
  for (const msg of opts.recentMessages) {
    messages.push({
      role: msg.role === "guide" ? "assistant" : "user",
      content: msg.content,
    });
  }

  // Add funnel context if in funnel
  if (opts.funnelState && opts.funnelState.currentLayer > 0) {
    const layer = opts.funnelState.currentLayer as FunnelLayer;
    const strategy = pickStrategy(opts.ageGroup, layer);
    const strategyHint = formatStrategyPrompt(strategy);

    const funnelContext = [
      `--- 当前漏斗状态 ---`,
      `第${layer}层：${getLayerLabel(layer)}`,
      `引导问题：${getLayerQuestion(layer)}`,
      strategyHint,
      ...Object.entries(opts.funnelState.layers)
        .filter(([, v]) => v.complete)
        .map(([k, v]) => `第${k}层「${v.label}」已完成：${v.content}`),
    ].join("\n");

    messages.push({ role: "system", content: funnelContext });
  }

  // Add current input
  messages.push({ role: "user", content: opts.currentInput });

  return messages;
}
