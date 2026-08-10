import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db/projects";
import { createReflection, getReflections } from "@/lib/db/reflections";
import { addLog } from "@/lib/db/project-logs";
import { buildReflectionQuestions } from "@/lib/engine/reflection-coach";
import { recordEvent } from "@/lib/engine/evidence-collector";
import { awardPoints } from "@/lib/engine/points-engine";
import { getAccount } from "@/lib/db/user-account";

export const dynamic = "force-dynamic";
import type { AgeGroup, ReflectionType } from "@/lib/utils/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ reflections: getReflections(params.id) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "error.project_not_found" }, { status: 404 });
  }

  const { type, trigger_ref, q1, q2, q3, q4, ageGroup } = await req.json() as {
    type: ReflectionType;
    trigger_ref?: string;
    q1?: string;
    q2?: string;
    q3?: string;
    q4?: string;
    ageGroup?: AgeGroup;
  };

  // If q1 is not provided, we're requesting questions (not submitting answers)
  if (!q1 && !q2 && !q3 && !q4) {
    const { questions, context_note } = await buildReflectionQuestions(
      project,
      ageGroup || "10-12",
      type,
      trigger_ref || null
    );
    return NextResponse.json({ questions, context_note });
  }

  // Submit answers
  const reflection = createReflection({
    project_id: params.id,
    type,
    trigger_ref: trigger_ref || null,
    q1: q1 || "",
    q2: q2 || "",
    q3: q3 || "",
    q4: q4 || "",
  });

  addLog(params.id, "reflection", `${type}复盘`);

  // Record evidence event
  recordEvent("reflection", "reflection_submit", "reflections", reflection.id, {
    type: reflection.type,
    has_q1: !!reflection.q1,
    has_q2: !!reflection.q2,
    has_q3: !!reflection.q3,
    has_q4: !!reflection.q4,
  });

  // P8a: award habit points for reflection
  const account = getAccount(childId);
  if (account) {
    awardPoints(account.id, "reflection", params.id);
  }

  return NextResponse.json({ reflection }, { status: 201 });
}
