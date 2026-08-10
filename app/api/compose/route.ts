import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/db/sessions";
import { composeSolutionPack } from "@/lib/compose/composer";
import { recordEvent } from "@/lib/engine/evidence-collector";
import type { AgeGroup } from "@/lib/utils/types";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json() as { sessionId: string };

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "error.session_not_found" }, { status: 404 });
  }

  const pack = await composeSolutionPack(sessionId, session.age_group as AgeGroup);

  if (!pack) {
    return NextResponse.json({ error: "error.pack_generation_failed" }, { status: 500 });
  }

  // Record evidence event
  recordEvent("creativity", "solution_generated", "solution_packs", pack.id);

  updateSession(sessionId, { status: "completed" });

  return NextResponse.json({ pack });
}
