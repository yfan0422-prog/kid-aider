import type { AgeGroup } from "@/lib/utils/types";
import type { FunnelLayer } from "./funnel-machine";
import { getStrategiesForLayer, type StrategyTemplate } from "./strategy-templates";
import { getAgeConfig } from "@/lib/utils/age-config";

export function pickStrategy(
  ageGroup: AgeGroup,
  funnelLayer: FunnelLayer
): StrategyTemplate {
  const config = getAgeConfig(ageGroup);
  const candidates = getStrategiesForLayer(funnelLayer);

  if (candidates.length === 0) {
    // Fallback to 5W1H
    return (getStrategiesForLayer(0).find(s => s.id === "5w1h") || getStrategiesForLayer(0)[0])!;
  }

  // For choice-oriented ages, prefer concretize and prioritize
  if (config.questionStyle === "choice") {
    const preferred = candidates.find(s => s.id === "prioritize" || s.id === "concretize");
    if (preferred) return preferred;
  }

  // For open-oriented ages, prefer magic-wand and teach-back
  if (config.questionStyle === "open") {
    const preferred = candidates.find(s => s.id === "magic-wand" || s.id === "teach-back");
    if (preferred) return preferred;
  }

  // Default: pick first available
  return candidates[0];
}

export function formatStrategyPrompt(strategy: StrategyTemplate): string {
  return `[引导策略：${strategy.name}]
${strategy.description}
参考示例："${strategy.example}"
请在回应中自然应用这个策略，不要直接说出策略名称。`;
}
