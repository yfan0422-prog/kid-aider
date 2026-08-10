import { NextRequest, NextResponse } from "next/server";
import { getAccount, updateAccount } from "@/lib/db/user-account";
import { initBadgeDefs } from "@/lib/db/badge-defs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  initBadgeDefs();
  const account = getAccount(childId);
  if (!account) return NextResponse.json({ error: "child_not_found" }, { status: 404 });
  return NextResponse.json({ account });
}

export async function PUT(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { display_name, avatar_emoji, language } = body as {
    display_name?: string;
    avatar_emoji?: string;
    language?: string;
  };

  const account = updateAccount(childId, {
    display_name,
    avatar_emoji,
    language,
  });
  if (!account) return NextResponse.json({ error: "child_not_found" }, { status: 404 });

  return NextResponse.json({ account });
}
