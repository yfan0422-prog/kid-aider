import { getTopic, getActiveContent } from "@/lib/db/topics";
import { generateContent } from "@/lib/engine/content-generator";
import { getOrCreateChildProfile } from "@/lib/db/child-profile";
import type { TopicLanguage } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

// In-flight guard: prevent concurrent generation for the same topic+age+language combo
const inFlight = new Set<string>();

function inflightKey(topicId: string, ageGroup: string, language: string): string {
  return `${topicId}|${ageGroup}|${language}`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const { language, force_refresh } = (await req.json().catch(() => ({}))) as {
    language?: TopicLanguage;
    force_refresh?: unknown;
  };
  const lang: TopicLanguage = language || topic.language;
  const forceRefresh = force_refresh === true;

  // If not force-refreshing and content already exists, return existing
  if (!forceRefresh) {
    const existing = getActiveContent(params.id, topic.age_group, lang);
    if (existing) {
      return Response.json({ content: existing, generated: false, reason: "content_exists" });
    }
  }

  // Check in-flight guard — prevent concurrent generation for same combo
  const key = inflightKey(params.id, topic.age_group, lang);
  if (inFlight.has(key)) {
    return Response.json({
      status: "generating",
      topic_id: params.id,
      language: lang,
      reason: "already_in_progress",
    });
  }

  // Fire-and-forget: start generation, return immediately with pending status
  const profile = getOrCreateChildProfile();

  // Mark as in-flight before starting async generation
  inFlight.add(key);

  // Start generation asynchronously
  const generationPromise = generateContent(topic, lang, profile);

  // Return a "generating" response immediately
  // The client polls GET /api/topics/[id]/contents to check for results
  generationPromise.then(
    (content) => {
      inFlight.delete(key);
      if (content) {
        console.log(`[generate] content generated for topic ${params.id} v${content.version}`);
      } else {
        console.error(`[generate] content generation failed for topic ${params.id}`);
      }
    },
    (err) => {
      inFlight.delete(key);
      console.error(`[generate] content generation failed for topic ${params.id}:`, err);
    },
  );

  return Response.json({
    status: "generating",
    topic_id: params.id,
    language: lang,
  });
}
