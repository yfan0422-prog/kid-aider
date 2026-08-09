import { deleteVersion } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string; versionId: string } }) {
  deleteVersion(params.versionId);
  return Response.json({ status: "deleted" });
}
