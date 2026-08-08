import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { buildResume } from "@/lib/engine/resume-builder";
import type { AgeGroup } from "@/lib/utils/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  const ageGroup = (req.nextUrl.searchParams.get("ageGroup") || "10-12") as AgeGroup;
  const resume = await buildResume(project, ageGroup);
  return NextResponse.json(resume);
}
