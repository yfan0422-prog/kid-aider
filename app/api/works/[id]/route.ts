import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { getWork, deleteWork, updateWorkMeta, resolveWorksPath } from "@/lib/db/works";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const work = getWork(params.id);
  if (!work || work.child_id !== childId) {
    return NextResponse.json({ error: "error.works.not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { title?: string; description?: string };
  const updated = updateWorkMeta(params.id, {
    title: typeof body.title === "string" ? body.title.trim() : undefined,
    description: typeof body.description === "string" ? body.description.trim() : undefined,
  });
  return NextResponse.json({ work: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const work = getWork(params.id);
  if (!work || work.child_id !== childId) {
    return NextResponse.json({ error: "error.works.not_found" }, { status: 404 });
  }

  const deleted = deleteWork(params.id);
  if (deleted) {
    await unlink(resolveWorksPath(deleted.filePath)).catch(() => {});
  }
  return NextResponse.json({ success: true });
}
