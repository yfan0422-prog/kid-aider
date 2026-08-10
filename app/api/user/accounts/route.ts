import { NextRequest, NextResponse } from "next/server";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getChildCount,
} from "@/lib/db/user-account";

// GET /api/user/accounts — 列出所有孩子
export async function GET() {
  const accounts = listAccounts();
  return NextResponse.json({ accounts });
}

// POST /api/user/accounts — 创建新孩子
export async function POST(req: NextRequest) {
  const body = await req.json() as { display_name?: string; avatar_emoji?: string; age_group?: string; language?: string };
  const account = createAccount(
    body.display_name || "小小探索者",
    body.avatar_emoji || "🧒",
    body.age_group || "10-12",
    body.language || "zh-CN"
  );
  return NextResponse.json({ account }, { status: 201 });
}

// PUT /api/user/accounts?id=xxx — 更新孩子信息
export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const body = await req.json() as Record<string, string>;
  const updated = updateAccount(id, {
    display_name: body.display_name,
    avatar_emoji: body.avatar_emoji,
    age_group: body.age_group,
    language: body.language,
  });
  if (!updated) return NextResponse.json({ error: "child_not_found" }, { status: 404 });
  return NextResponse.json({ account: updated });
}

// DELETE /api/user/accounts?id=xxx — 删除孩子
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const count = getChildCount();
  if (count <= 1) {
    return NextResponse.json({ error: "last_child_blocked" }, { status: 400 });
  }

  deleteAccount(id);
  return NextResponse.json({ success: true });
}
