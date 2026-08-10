import { reviewSuggestion, createTopic } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { status, topic_title, topic_summary, category, age_group, language } = (await req.json()) as {
    status?: string;
    topic_title?: string;
    topic_summary?: string;
    category?: string;
    age_group?: string;
    language?: string;
  };

  if (status !== "approved" && status !== "rejected") {
    return Response.json({ error: "error.invalid_suggestion_status" }, { status: 400 });
  }

  if (status === "approved") {
    if (!topic_title || !topic_summary || !category || !age_group) {
      return Response.json(
        { error: "error.approval_fields_required" },
        { status: 400 }
      );
    }

    // Create the topic from the approved suggestion
    createTopic({
      title: topic_title,
      summary: topic_summary,
      category,
      age_group,
      language: language || "zh-CN",
      source: "auto_suggested",
    });
  }

  reviewSuggestion(params.id, status);
  return Response.json({ status: "reviewed", suggestion_id: params.id, result: status });
}
