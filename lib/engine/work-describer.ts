import { routeModel } from "@/lib/models/router";
import type { OpenAIAdapter } from "@/lib/models/openai-adapter";
import type { AgeGroup } from "@/lib/utils/types";

export interface WorkDescription {
  title: string;
  description: string;
  encouragement: string;
}

function stripCodeFence(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "");
  s = s.replace(/\s*```$/, "");
  return s;
}

export async function describeWork(opts: {
  imageDataUrl: string;
  title?: string;
  ageGroup: AgeGroup;
  lang: string;
}): Promise<WorkDescription> {
  const routed = routeModel("dialogue");
  if (!routed) return { title: opts.title ?? "", description: "", encouragement: "" };

  // 看图仅支持 OpenAI 兼容（多模态）模型；Anthropic 文本模型无法接收图片，显式降级
  if (routed.profile.provider === "anthropic") {
    return { title: opts.title ?? "", description: "", encouragement: "" };
  }

  const adapter = routed.adapter as OpenAIAdapter;

  const isEnglish = opts.lang === "en";
  const system = isEnglish
    ? 'You are a warm companion for a child. Look at this child\'s offline creation photo. Respond ONLY with a strict JSON object with keys: "title" (short title), "description" (2-3 sentences), "encouragement" (one sincere sentence).'
    : '你是一位懂孩子的温暖陪伴者。请看这个孩子的线下作品照片，只返回一个严格的 JSON 对象，字段为："title"（简短标题）、"description"（2-3 句描述作品）、"encouragement"（一句真诚鼓励）。';
  const user = isEnglish
    ? "Describe this child's work."
    : `孩子的年龄段：${opts.ageGroup}。请描述这件作品。`;

  try {
    // 上面的 provider 检查已排除 Anthropic，此处 cast 到 OpenAIAdapter 是安全的
    const raw = await adapter.chat({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: opts.imageDataUrl } },
          ],
        },
      ],
      temperature: 0.6,
    });

    const parsed = JSON.parse(stripCodeFence(raw)) as Partial<WorkDescription>;
    const title = typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : (opts.title ?? "");
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const encouragement = typeof parsed.encouragement === "string" ? parsed.encouragement.trim() : "";
    return { title, description, encouragement };
  } catch {
    return { title: opts.title ?? "", description: "", encouragement: "" };
  }
}
