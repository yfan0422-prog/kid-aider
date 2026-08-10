import { getTopic } from "@/lib/db/topics";
import { getProjectByTopic } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "error.topic_not_found" }, { status: 404 });
  }

  const project = getProjectByTopic(params.id);
  if (project) {
    return Response.json({ has_project: true, project_id: project.id });
  }
  return Response.json({ has_project: false });
}
