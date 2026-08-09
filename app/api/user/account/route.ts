import { getOrCreateAccount, updateAccount } from "@/lib/db/user-account";
import { initBadgeDefs } from "@/lib/db/badge-defs";

export const dynamic = "force-dynamic";

export async function GET() {
  initBadgeDefs();
  const account = getOrCreateAccount();
  return Response.json({ account });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { display_name, avatar_emoji, language } = body as {
    display_name?: string;
    avatar_emoji?: string;
    language?: string;
  };

  const account = updateAccount({
    display_name,
    avatar_emoji,
    language,
  });

  return Response.json({ account });
}
