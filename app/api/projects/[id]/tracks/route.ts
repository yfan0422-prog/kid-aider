import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { createTrack, getTracks, deleteTrack } from "@/lib/db/tracks";
import type { TrackType } from "@/lib/utils/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ tracks: getTracks(params.id) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const { name, type } = await req.json() as { name: string; type: TrackType };
  const track = createTrack({ project_id: params.id, name, type });
  return NextResponse.json({ track }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  void params;
  const trackId = req.nextUrl.searchParams.get("trackId");
  if (!trackId) {
    return NextResponse.json({ error: "缺少 trackId" }, { status: 400 });
  }
  deleteTrack(trackId);
  return NextResponse.json({ success: true });
}
