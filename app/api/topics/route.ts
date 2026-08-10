import { listTopics, createTopic } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const age = searchParams.get("age") || undefined;
  const category = searchParams.get("category") || undefined;
  const language = searchParams.get("language") || undefined;
  const source = searchParams.get("source") || undefined;

  const topics = listTopics({
    age,
    category,
    language,
    source,
    isActive: true,
  });

  return Response.json({ topics });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, summary, cover_image, category, age_group, language, interest_tag } = body;

  if (!title || !summary || !category || !age_group) {
    return Response.json({ error: "error.topic_fields_required" }, { status: 400 });
  }

  const topic = createTopic({
    title,
    summary,
    cover_image: cover_image || undefined,
    category,
    age_group,
    language: language || "zh-CN",
    interest_tag: interest_tag || undefined,
    source: "manual",
  });

  return Response.json({ topic }, { status: 201 });
}
