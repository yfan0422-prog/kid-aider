import { getPendingSuggestions } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function GET() {
  const suggestions = getPendingSuggestions();
  return Response.json({ suggestions });
}
