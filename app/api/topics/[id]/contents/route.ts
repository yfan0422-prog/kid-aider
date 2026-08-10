import { getTopic } from "@/lib/db/topics";
import { getActiveContent } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "error.topic_not_found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const ageGroup = searchParams.get("age_group") || topic.age_group;
  const language = searchParams.get("language") || topic.language;

  const content = getActiveContent(params.id, ageGroup, language);

  return Response.json({
    topic,
    content: content || null,
    hasContent: content !== undefined,
  });
}
