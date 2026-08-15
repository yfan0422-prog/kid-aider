import { NextRequest } from "next/server";
import { getSession, deleteSession } from "@/lib/db/sessions";
import { getMessages } from "@/lib/db/messages";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession(params.id);
  if (!session) {
    return Response.json({ error: "error.session_not_found" }, { status: 404 });
  }
  const messages = getMessages(params.id);
  return Response.json({ session, messages });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession(params.id);
  if (!session) {
    return Response.json({ error: "error.session_not_found" }, { status: 404 });
  }
  // 归属校验：仅允许删除当前孩子的会话，避免跨孩子误删
  const childId = req.nextUrl.searchParams.get("child_id");
  if (childId && session.child_id && session.child_id !== childId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  deleteSession(params.id);
  return Response.json({ ok: true });
}
