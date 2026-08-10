import { routeModel } from "@/lib/models/router";
import { createTopicContent, getLatestVersionNumber } from "@/lib/db/topics";
import type {
  TopicCatalog,
  TopicContent,
  Challenge,
  GeneratedContent,
  TopicLanguage,
  ChildProfile,
} from "@/lib/utils/types";

const RULE_VERSION = "v1.0.0";

// ─── 年龄规则 ───────────────────────────────────────────────────

interface AgeRules {
  introMaxChars: number;
  maxCharsPerSentence: number;
  terminologyLevel: string;
  challengeCount: number;
  difficultyBaseline: number;
  toneStyle: string;
}

function getAgeRules(ageGroup: string): AgeRules {
  switch (ageGroup) {
    case "6-9":
      return {
        introMaxChars: 80,
        maxCharsPerSentence: 15,
        terminologyLevel: "avoid_all_terminology",
        challengeCount: 2,
        difficultyBaseline: 1,
        toneStyle: "wonder",
      };
    case "10-12":
      return {
        introMaxChars: 150,
        maxCharsPerSentence: 25,
        terminologyLevel: "introduce_1_2_terms",
        challengeCount: 3,
        difficultyBaseline: 2,
        toneStyle: "inviting",
      };
    case "13-15":
      return {
        introMaxChars: 300,
        maxCharsPerSentence: Infinity,
        terminologyLevel: "standard_terminology",
        challengeCount: 3,
        difficultyBaseline: 3,
        toneStyle: "equal_dialogue",
      };
    default:
      return getAgeRules("10-12");
  }
}

function getToneInstruction(style: string): string {
  switch (style) {
    case "wonder":
      return "使用惊叹式语气，多用“哇！”“你知道吗？”等惊奇表达。句子简短活泼。";
    case "inviting":
      return "使用邀请式语气，多用“试试看”“想一想”等引导表达。鼓励孩子主动探索。";
    case "equal_dialogue":
      return "使用平等对话语气，像与朋友交流一样自然。可直接讨论抽象概念。";
    default:
      return "";
  }
}

// ─── 能力规则 ───────────────────────────────────────────────────

interface AbilityAdjustments {
  addFreeformChallenge: boolean;
  addHintToAllChallenges: boolean;
  shortParagraphs: boolean;
  midSessionBreak: boolean;
  addOutputTask: boolean;
  addExtensionQuestion: boolean;
  useStrongerHook: boolean;
}

function getAbilityAdjustments(profile: ChildProfile | null): AbilityAdjustments {
  if (!profile) {
    return {
      addFreeformChallenge: false,
      addHintToAllChallenges: false,
      shortParagraphs: false,
      midSessionBreak: false,
      addOutputTask: false,
      addExtensionQuestion: false,
      useStrongerHook: false,
    };
  }

  return {
    addFreeformChallenge: profile.ability_creativity > 0.7,
    addHintToAllChallenges: profile.ability_logical < 0.3 || profile.ability_focus < 0.3,
    shortParagraphs: profile.ability_focus < 0.3,
    midSessionBreak: profile.ability_focus < 0.3,
    addOutputTask: profile.ability_expression > 0.7,
    addExtensionQuestion: profile.ability_curiosity > 0.7,
    useStrongerHook: profile.ability_curiosity < 0.3,
  };
}

function buildAbilityInstructions(adj: AbilityAdjustments): string {
  const instructions: string[] = [];
  if (adj.addFreeformChallenge) {
    instructions.push("- 在挑战末尾增加一个“自由发挥”项：标题为“你的创意时间”，不设标准答案，鼓励孩子按自己的方式探索。");
  }
  if (adj.addHintToAllChallenges) {
    instructions.push("- 每个挑战额外附带一条“小提示”，给出推理线索或操作建议，降低挫败感。");
  }
  if (adj.shortParagraphs) {
    instructions.push("- 简介每段不超过 3 句话，保持段落短小，便于保持注意力。");
  }
  if (adj.midSessionBreak) {
    instructions.push("- 在第 2 个挑战后面插入一个“中场休息”提示：给出一个简单的伸展或深呼吸建议。");
  }
  if (adj.addOutputTask) {
    instructions.push("- 挑战中加入一个输出型任务：要求孩子把学到的内容“讲给别人听”或“画出来”。");
  }
  if (adj.addExtensionQuestion) {
    instructions.push("- 简介末尾追加一个“延伸探索”问题，激发孩子进一步思考。");
  }
  if (adj.useStrongerHook) {
    instructions.push("- 简介开头用一个更强的趣味钩子（有趣的事实、惊人的问题等）来吸引注意力。");
  }
  return instructions.join("\n");
}

// ─── 呈分试规则 ──────────────────────────────────────────────────

const SFA_ALIGNMENT_INSTRUCTION = `
你生成的内容应隐式对齐香港小学课程指引（不对孩子显示）：
- 中文：覆盖阅读理解策略、写作结构、词彙运用、标点规范
- 英文：Reading comprehension, grammar in context, creative expression, vocabulary building
- 数学：应用题拆解、速算策略、逻辑推理、图解表达
- 综合：时间管理、考试策略、错题分析方法、专注力训练

内容形式保持探索式学习风格——不刷题、不补习，以话题化 PBL 项目自然覆盖能力点。`;

const SFA_CATEGORIES = ["中文精进", "英文探索", "数学思维", "综合能力"];

// ─── 语言规则 ───────────────────────────────────────────────────

function getLanguageInstruction(language: TopicLanguage): string {
  switch (language) {
    case "zh-CN":
      return "使用简体中文输出。使用中国大陆用语习惯。";
    case "zh-HK":
      return "使用繁體中文輸出。使用香港用語習慣（例如：的士而非出租車、雪櫃而非冰箱、電腦而非計算機、質素而非質量）。";
    case "en":
      return "Output in English. Use age-appropriate vocabulary. For younger children, use simple words and short sentences. For older children, introduce richer vocabulary.";
    default:
      return "使用简体中文输出。";
  }
}

// ─── Prompt 构建 ─────────────────────────────────────────────────

export function buildGenerationPrompt(opts: {
  topic: TopicCatalog;
  language: TopicLanguage;
  profile: ChildProfile | null;
}): string {
  const ageRules = getAgeRules(opts.topic.age_group === "all" ? "10-12" : opts.topic.age_group);
  const adj = getAbilityAdjustments(opts.profile);
  const langInst = getLanguageInstruction(opts.language);
  const isSFA = SFA_CATEGORIES.includes(opts.topic.category);

  const hasAbilityAdjustment =
    adj.addFreeformChallenge ||
    adj.addHintToAllChallenges ||
    adj.shortParagraphs ||
    adj.midSessionBreak ||
    adj.addOutputTask ||
    adj.addExtensionQuestion ||
    adj.useStrongerHook;

  const sections: string[] = [
    "你是一个儿童教育内容生成专家。请为以下话题生成结构化学习内容。",
    "",
    "## 话题信息",
    `- 标题：${opts.topic.title}`,
    `- 简介方向：${opts.topic.summary}`,
    `- 分类：${opts.topic.category}`,
    `- 目标年龄段：${opts.topic.age_group === "all" ? "全年龄" : `${opts.topic.age_group} 岁`}`,
    "",
    "## 格式要求",
    "请输出以下 JSON 结构（不要输出任何 JSON 之外的文本）：",
    "{",
    `  "intro": "## {标题}\\n\\n...百科简介(markdown)...",`,
    "  \"challenges\": [",
    "    {",
    `      "title": "挑战名称（孩子友好）",`,
    `      "description": "怎么做（步骤化，按年龄控制步数）",`,
    `      "hint": "小提示" | null,`,
    `      "difficulty": 1-3,`,
    `      "materials": ["需要的材料", "可替代材料"],`,
    `      "estimated_minutes": 15`,
    "    }",
    "  ],",
    `  "project_prompt": "对这个话题感兴趣？...（引导进入项目工坊的种子文本）",`,
    "  \"image_prompts\": [",
    `    {"section": "intro", "prompt": "简介配图的英文 AI 绘画提示词"},`,
    `    {"section": "challenge_0", "prompt": "挑战1配图的英文 AI 绘画提示词"}`,
    "  ]",
    "}",
    "",
    "## 年龄适配规则",
    `- 百科简介字数：≤${ageRules.introMaxChars} 字`,
    `- 句子长度：≤${ageRules.maxCharsPerSentence === Infinity ? "无限制" : `${ageRules.maxCharsPerSentence} 字/句`}`,
    `- 用词等级：${ageRules.terminologyLevel === "avoid_all_terminology" ? "纯生活用语，不使用任何专业术语" : ageRules.terminologyLevel === "introduce_1_2_terms" ? "可引入 1-2 个核心术语，但要用简单语言解释" : "可使用学科标准术语"}`,
    `- 互动挑战数：${ageRules.challengeCount} 个`,
    `- 挑战难度基线：${ageRules.difficultyBaseline} 级（1-3）`,
    `- 语气风格：${getToneInstruction(ageRules.toneStyle)}`,
    "",
  ];

  if (hasAbilityAdjustment) {
    sections.push("## 能力适配规则");
    sections.push(buildAbilityInstructions(adj));
    sections.push("");
  }

  if (isSFA) {
    sections.push("## 呈分试对齐规则");
    sections.push(SFA_ALIGNMENT_INSTRUCTION);
    sections.push("");
  }

  sections.push("## 语言规则");
  sections.push(langInst);
  sections.push("");
  sections.push("请直接输出 JSON，不要使用 markdown 代码块包裹。");

  return sections.join("\n");
}

// ─── JSON 解析与校验 ───────────────────────────────────────────

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  // Try plain JSON first
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fence-stripping below
  }

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(fenced);
  } catch {
    // fall through to balanced-brace extraction below
  }

  // Last resort: extract the first balanced { ... } object
  const start = fenced.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < fenced.length; i++) {
    if (fenced[i] === "{") depth++;
    else if (fenced[i] === "}") {
      depth--;
      if (depth === 0) {
        const raw = fenced.slice(start, i + 1);
        try {
          return JSON.parse(raw);
        } catch {
          // LLMs often emit literal newlines inside JSON strings.
          // Attempt to escape them and retry.
          try {
            return JSON.parse(escapeNewlinesInJsonStrings(raw));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Escape literal newlines that appear inside JSON string values.
 * Walks the JSON token stream: when inside a string (tracked by
 * unescaped double-quote pairs), replaces literal \n and \r with
 * their escaped forms.
 */
function escapeNewlinesInJsonStrings(json: string): string {
  const out: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escape) {
      out.push(ch);
      escape = false;
      continue;
    }
    if (ch === "\\") {
      out.push(ch);
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out.push(ch);
      continue;
    }
    if (inString && ch === "\n") {
      out.push("\\n");
    } else if (inString && ch === "\r") {
      out.push("\\r");
    } else {
      out.push(ch);
    }
  }
  return out.join("");
}

function normalizeGeneratedContent(parsed: unknown): GeneratedContent | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const g = parsed as Record<string, unknown>;

  // Required fields: non-empty intro + at least one well-formed challenge
  if (typeof g.intro !== "string" || g.intro.length === 0) return null;
  if (!Array.isArray(g.challenges) || g.challenges.length === 0) return null;

  const challenges: Challenge[] = [];
  for (const raw of g.challenges) {
    if (typeof raw !== "object" || raw === null) return null;
    const c = raw as Record<string, unknown>;
    if (typeof c.title !== "string" || c.title.length === 0) return null;
    if (typeof c.description !== "string" || c.description.length === 0) return null;
    challenges.push({
      title: c.title,
      description: c.description,
      hint: typeof c.hint === "string" ? c.hint : null,
      difficulty: typeof c.difficulty === "number" ? c.difficulty : 1,
      materials: Array.isArray(c.materials)
        ? c.materials.filter((m): m is string => typeof m === "string")
        : [],
      estimated_minutes: typeof c.estimated_minutes === "number" ? c.estimated_minutes : 15,
    });
  }

  const imagePrompts: { section: string; prompt: string }[] = [];
  if (Array.isArray(g.image_prompts)) {
    for (const raw of g.image_prompts) {
      if (typeof raw === "object" && raw !== null) {
        const ip = raw as Record<string, unknown>;
        if (typeof ip.section === "string" && typeof ip.prompt === "string") {
          imagePrompts.push({ section: ip.section, prompt: ip.prompt });
        }
      }
    }
  }

  return {
    intro: g.intro,
    challenges,
    project_prompt: typeof g.project_prompt === "string" ? g.project_prompt : "",
    image_prompts: imagePrompts,
  };
}

// ─── 生成入口 ───────────────────────────────────────────────────

export async function generateContent(
  topic: TopicCatalog,
  language: TopicLanguage,
  profile?: ChildProfile | null
): Promise<TopicContent | null> {
  const routed = routeModel("dialogue");
  if (!routed) {
    console.error("[content-generator] no model available for dialogue role");
    return null;
  }

  const p = profile ?? null;
  const prompt = buildGenerationPrompt({ topic, language, profile: p });
  const ageGroup = topic.age_group;
  const newVersion = getLatestVersionNumber(topic.id, ageGroup, language) + 1;

  try {
    // Adapter interface deviation (vs brief): both adapters expose
    // chat({ messages, temperature?, max_tokens? }) → Promise<string>.
    // There is no top-level `system` option; the system prompt is passed as a
    // system-role message. The Anthropic adapter lifts it to the API's `system`
    // field internally. The return value is a plain string, not { content }.
    const content = await routed.adapter.chat({
      messages: [{ role: "system", content: prompt }],
      max_tokens: 2048,
    });

    const parsed = normalizeGeneratedContent(extractJsonObject(content || ""));
    if (!parsed) {
      console.error(
        "[content-generator] failed to parse/validate LLM response:",
        (content || "").slice(0, 200)
      );
      return null;
    }

    return createTopicContent({
      topic_id: topic.id,
      age_group: ageGroup,
      language,
      version: newVersion,
      intro_text: parsed.intro,
      challenges: parsed.challenges,
      project_prompt: parsed.project_prompt || undefined,
      image_prompts: parsed.image_prompts.length > 0 ? parsed.image_prompts : undefined,
      generation_rule_version: RULE_VERSION,
    });
  } catch (err) {
    console.error("[content-generator] generation failed:", err);
    return null;
  }
}
