import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/db/sessions";
import { composeSolutionPack } from "@/lib/compose/composer";
import type { AgeGroup } from "@/lib/utils/types";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json() as { sessionId: string };

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  const pack = await composeSolutionPack(sessionId, session.age_group as AgeGroup);

  if (!pack) {
    return NextResponse.json({ error: "生成方案包失败。请确认需求已完整填写。" }, { status: 500 });
  }

  updateSession(sessionId, { status: "completed" });

  return NextResponse.json({ pack });
}
