import { getSession } from "@/lib/db/sessions";
import { getMessages } from "@/lib/db/messages";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession(params.id);
  if (!session) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }
  const messages = getMessages(params.id);
  return Response.json({ session, messages });
}
