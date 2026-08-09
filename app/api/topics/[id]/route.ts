import { getTopic, updateTopic, softDeleteTopic } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const body = await req.json();
  updateTopic(params.id, body);
  const updated = getTopic(params.id);

  return Response.json({ topic: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const topic = getTopic(params.id);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  softDeleteTopic(params.id);
  return Response.json({ status: "deleted" });
}
