import { activateVersion } from "@/lib/db/topics";

export const dynamic = "force-dynamic";

export async function PUT(_req: Request, { params }: { params: { id: string; versionId: string } }) {
  activateVersion(params.versionId);
  return Response.json({ status: "activated", version_id: params.versionId });
}
