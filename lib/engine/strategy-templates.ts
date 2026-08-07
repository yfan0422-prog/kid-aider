export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  example: string;
  applicableFunnelLayers: number[]; // 0 = outside funnel
}

export const STRATEGY_TEMPLATES: Record<string, StrategyTemplate> = {
  "5w1h": {
    id: "5w1h",
    name: "5W1H 澄清",
    description: "谁/什么/何时/何地/为什么/怎么做",
    example: "这个游戏是给谁玩的？",
    applicableFunnelLayers: [0, 1, 2],
  },
  "magic-wand": {
    id: "magic-wand",
    name: "魔法棒提问",
    description: "抛开限制想理想态",
    example: "如果有一根魔法棒，你希望它变成什么样？",
    applicableFunnelLayers: [0, 1],
  },
  "concretize": {
    id: "concretize",
    name: "具象化",
    description: "把抽象变具体",
    example: "你说的'好玩'，是像哪个游戏那样好玩？",
    applicableFunnelLayers: [1, 3, 4],
  },
  "prioritize": {
    id: "prioritize",
    name: "排序选择",
    description: "训练优先级思维",
    example: "这三个功能，你最想先要有哪一个？",
    applicableFunnelLayers: [2, 3],
  },
  "counter-example": {
    id: "counter-example",
    name: "反例检验",
    description: "训练边界思维",
    example: "什么情况出现时，说明它做得不对？",
    applicableFunnelLayers: [4],
  },
  "teach-back": {
    id: "teach-back",
    name: "教回去（费曼技巧）",
    description: "让孩子讲给别人听",
    example: "你能假装我是小同学，给我讲讲你的方案吗？",
    applicableFunnelLayers: [1, 2, 3, 4, 5],
  },
  "chunk-down": {
    id: "chunk-down",
    name: "拆分游戏",
    description: "把大问题切成小块",
    example: "我们先只做'按下按钮会亮'这一小步好不好？",
    applicableFunnelLayers: [2, 3],
  },
  "reflect-compare": {
    id: "reflect-compare",
    name: "对比反思",
    description: "对比前后变化",
    example: "你一开始的想法和现在相比，哪里不一样了？",
    applicableFunnelLayers: [5],
  },
};

export function getStrategiesForLayer(layer: number): StrategyTemplate[] {
  return Object.values(STRATEGY_TEMPLATES).filter(s =>
    s.applicableFunnelLayers.includes(layer)
  );
}
