export type FunnelLayer = 0 | 1 | 2 | 3 | 4 | 5;

export interface FunnelState {
  currentLayer: FunnelLayer;
  layers: Record<number, FunnelLayerData>;
}

export interface FunnelLayerData {
  label: string;
  question: string;
  content: string;
  complete: boolean;
}

const FUNNEL_LAYERS: Array<{ label: string; question: string }> = [
  { label: "愿望", question: "你想做什么？用一句话说说你的想法。" },
  { label: "对象", question: "给谁用/为了什么呢？" },
  { label: "功能", question: "它需要做哪几件事？我们列出3个左右就好。" },
  { label: "约束", question: "有什么限制吗？比如时间、材料、或者你现在会做的事情。" },
  { label: "验收", question: "怎样算做好了？你自己来定义成功的标准。" },
];

export function createFunnelState(): FunnelState {
  return {
    currentLayer: 1,
    layers: Object.fromEntries(
      FUNNEL_LAYERS.map((l, i) => [
        i + 1,
        { label: l.label, question: l.question, content: "", complete: false },
      ])
    ),
  };
}

export function getLayerQuestion(layer: FunnelLayer): string {
  if (layer === 0) return "";
  return FUNNEL_LAYERS[layer - 1].question;
}

export function getLayerLabel(layer: FunnelLayer): string {
  if (layer === 0) return "";
  return FUNNEL_LAYERS[layer - 1].label;
}

export function isFunnelComplete(state: FunnelState): boolean {
  return Object.values(state.layers).every(l => l.complete);
}

export function getMissingLayers(state: FunnelState): number[] {
  return Object.entries(state.layers)
    .filter(([, v]) => !v.complete)
    .map(([k]) => parseInt(k));
}

export interface FunnelTransition {
  action: "stay" | "advance" | "complete";
  currentLayer: FunnelLayer;
  nextQuestion?: string;
  summary?: string;
}

export function evaluateLayerCompletion(
  state: FunnelState,
  childResponse: string
): FunnelTransition {
  const layer = state.currentLayer;
  if (layer === 0) {
    return { action: "advance", currentLayer: 1, nextQuestion: getLayerQuestion(1) };
  }

  // Simple heuristic: if child's response is substantive enough (not just "不知道" or too short),
  // mark current layer complete and advance
  const isSubstantive = childResponse.length > 5 && !/^不知道|^不会|^不懂/.test(childResponse);

  if (isSubstantive) {
    state.layers[layer].content = childResponse;
    state.layers[layer].complete = true;

    if (layer >= 5) {
      return { action: "complete", currentLayer: 5 };
    }

    const nextLayer = (layer + 1) as FunnelLayer;
    state.currentLayer = nextLayer;
    return {
      action: "advance",
      currentLayer: nextLayer,
      nextQuestion: getLayerQuestion(nextLayer),
      summary: `好的，关于「${getLayerLabel(layer)}」我记下了。接下来我们想想「${getLayerLabel(nextLayer)}」。`,
    };
  }

  // Stay on current layer, rephrase
  return {
    action: "stay",
    currentLayer: layer,
    nextQuestion: `没关系的，我们慢慢想。${getLayerQuestion(layer)}`,
  };
}

export class FunnelMachine {
  private state: FunnelState;

  constructor() {
    this.state = createFunnelState();
  }

  getState(): FunnelState {
    return this.state;
  }

  advance(input: string): FunnelTransition {
    return evaluateLayerCompletion(this.state, input);
  }
}
