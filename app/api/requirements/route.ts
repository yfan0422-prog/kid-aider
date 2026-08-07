import { NextRequest, NextResponse } from "next/server";
import { getRequirementNodes } from "@/lib/db/requirements";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const nodes = getRequirementNodes(sessionId);
  return NextResponse.json({ nodes });
}
