import type { AudioFeatures } from "./audio-features";
import { routeModel } from "@/lib/models/router";

export type EmotionLabel = "excited" | "calm" | "frustrated" | "impatient" | "confused";

export interface EmotionResult {
  emotion: EmotionLabel;
  confidence: number;
  modelUsed: "rule" | "llm" | "rule+llm";
  reason: string;
}

export interface ClassifyOpts {
  text: string;
  history?: string[];
  audioFeatures?: AudioFeatures;
  sessionId?: string;
}

// --- 规则分类 ---

interface RuleEmotion {
  emotion: EmotionLabel;
  confidence: number;
  reason: string;
}

function classifyByRules(opts: ClassifyOpts): RuleEmotion {
  const text = opts.text ?? "";
  const { audioFeatures } = opts;

  // 文字信号
  const excitedWords = ["太棒", "好厉害", "哇", "耶", "哈哈", "开心", "好玩", "喜欢"];
  const frustratedWords = ["不行", "不会", "好难", "做不到", "算了", "不想", "讨厌", "烦"];
  const impatientWords = ["快点", "快", "马上", "现在", "赶紧", "立刻"];
  const confusedWords = ["为什么", "什么意思", "不懂", "不明白", "怎么", "什么", "哪个"];
  const questionWords = ["为什么", "怎么", "什么", "哪", "谁", "吗", "呢"];

  const excitedScore = excitedWords.filter((w) => text.includes(w)).length;
  const frustratedScore = frustratedWords.filter((w) => text.includes(w)).length;
  const impatientScore = impatientWords.filter((w) => text.includes(w)).length;
  const confusedScore = confusedWords.filter((w) => text.includes(w)).length;
  const questionCount = questionWords.filter((w) => text.includes(w)).length;

  // 语音信号增强
  let voiceExcitement = 0;
  let voiceFrustration = 0;
  let voiceImpatience = 0;
  let voiceConfusion = 0;

  if (audioFeatures) {
    const { pitch, duration, volume } = audioFeatures;
    // 高音高 + 大音量 → 兴奋
    if (pitch > 300 && volume > 0.5) voiceExcitement += 2;
    // 低音高 + 小音量 → 沮丧
    if (pitch < 200 && volume < 0.2) voiceFrustration += 2;
    // 极短时长(快语速) → 着急
    if (duration < 2.0 && volume > 0.4) voiceImpatience += 2;
    // 时长偏长但文字很少(停顿多) → 困惑
    if (duration > 5.0 && text.length < 20) voiceConfusion += 2;
  }

  const scores: { emotion: EmotionLabel; score: number }[] = [
    { emotion: "excited", score: excitedScore + voiceExcitement },
    { emotion: "frustrated", score: frustratedScore + voiceFrustration },
    { emotion: "impatient", score: impatientScore + voiceImpatience },
    { emotion: "confused", score: confusedScore + questionCount + voiceConfusion },
    { emotion: "calm", score: 1 }, // 默认基线
  ];

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const confidence = top.score > 1 ? 0.7 : 0.5;

  const reasons: Record<EmotionLabel, string> = {
    excited: "检测到积极关键词和/或高唤醒语音特征",
    calm: "未检测到显著情绪信号",
    frustrated: "检测到否定/消极关键词和/或低唤醒语音特征",
    impatient: "检测到催促关键词和/或快速语音",
    confused: "检测到疑问关键词和/或停顿特征",
  };

  return { emotion: top.emotion, confidence, reason: reasons[top.emotion] };
}

// --- LLM 分类 ---

const EMOTION_PROMPT = `Analyze the child's current emotional state from the conversation.
Return ONLY a JSON object (no markdown, no code block):

{"emotion":"excited|calm|frustrated|impatient|confused","confidence":0.0-1.0,"reason":"brief analysis in English"}

Emotion definitions:
- excited: positive high-arousal (happy, enthusiastic, amazed)
- calm: neutral low-arousal (normal, relaxed, focused)
- frustrated: negative low-arousal (sad, discouraged, disappointed)
- impatient: negative high-arousal (angry, demanding, rushing)
- confused: neutral high-arousal (uncertain, puzzled, questioning)`;

async function classifyByLLM(opts: ClassifyOpts): Promise<RuleEmotion | null> {
  const model = routeModel("dialogue");
  if (!model) return null; // 无可用模型

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: EMOTION_PROMPT },
  ];

  if (opts.history && opts.history.length > 0) {
    messages.push({
      role: "user",
      content: `Conversation history:\n${opts.history.join("\n")}\n\nChild's latest message: "${opts.text}"`,
    });
  } else {
    messages.push({ role: "user", content: `Child's message: "${opts.text}"` });
  }

  try {
    const result = await Promise.race([
      model.adapter.chat({ messages, temperature: 0.3, max_tokens: 128 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    if (!result) return null;

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const validEmotions: EmotionLabel[] = ["excited", "calm", "frustrated", "impatient", "confused"];
    if (!validEmotions.includes(parsed.emotion)) return null;

    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.7;

    return {
      emotion: parsed.emotion as EmotionLabel,
      confidence: clamp(confidence, 0, 1),
      reason: parsed.reason || "LLM classification",
    };
  } catch {
    return null;
  }
}

// --- 融合 ---

export async function classifyEmotion(opts: ClassifyOpts): Promise<EmotionResult> {
  // 第一轨：规则（即时）
  const ruleResult = classifyByRules(opts);

  // 第二轨：LLM（异步覆盖）
  try {
    const llmResult = await classifyByLLM(opts);

    if (llmResult && llmResult.confidence >= 0.6) {
      return {
        emotion: llmResult.emotion,
        confidence: llmResult.confidence,
        modelUsed: "rule+llm",
        reason: llmResult.reason,
      };
    }
  } catch {
    // LLM 失败，保持规则结果
  }

  return {
    ...ruleResult,
    modelUsed: "rule",
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
