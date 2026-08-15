import { NextRequest, NextResponse } from "next/server";
import { listSessionsByChild } from "@/lib/db/sessions";

export const dynamic = "force-dynamic";

/** 列出某个孩子的历史会话，供「历史」下拉列表使用 */
export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) {
    return NextResponse.json({ error: "child_required" }, { status: 400 });
  }
  const sessions = listSessionsByChild(childId);
  return NextResponse.json({ sessions });
}
