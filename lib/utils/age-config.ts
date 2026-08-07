import type { AgeGroup } from "@/lib/utils/types";

export interface AgeConfig {
  maxReplyLength: number;       // max chars per system reply
  systemSpeechRate: number;     // chars per response (used for truncation guidance)
  maxQuestionsPerRound: number; // max follow-up questions per turn
  fontSize: string;             // base font size class
  inputMode: "voice-first" | "mixed" | "text-first";
  questionStyle: "choice" | "semi-open" | "open";
  funnelNodeStyle: "picture-cards" | "graphic-nodes" | "structured-doc";
  confirmationMethod: "read-aloud" | "click-confirm" | "rewrite";
  reflectionDepth: number;
}

const AGE_CONFIGS: Record<AgeGroup, AgeConfig> = {
  "6-9": {
    maxReplyLength: 60,
    systemSpeechRate: 3.8,
    maxQuestionsPerRound: 1,
    fontSize: "text-body-lg",
    inputMode: "voice-first",
    questionStyle: "choice",
    funnelNodeStyle: "picture-cards",
    confirmationMethod: "read-aloud",
    reflectionDepth: 1,
  },
  "10-12": {
    maxReplyLength: 120,
    systemSpeechRate: 4.2,
    maxQuestionsPerRound: 2,
    fontSize: "text-body-lg",
    inputMode: "mixed",
    questionStyle: "semi-open",
    funnelNodeStyle: "graphic-nodes",
    confirmationMethod: "click-confirm",
    reflectionDepth: 2,
  },
  "13-15": {
    maxReplyLength: 200,
    systemSpeechRate: 4.5,
    maxQuestionsPerRound: 2,
    fontSize: "text-body",
    inputMode: "text-first",
    questionStyle: "open",
    funnelNodeStyle: "structured-doc",
    confirmationMethod: "rewrite",
    reflectionDepth: 4,
  },
};

export function getAgeConfig(ageGroup: AgeGroup): AgeConfig {
  return AGE_CONFIGS[ageGroup];
}
