import { NextRequest, NextResponse } from "next/server";
import {
  listModelProfiles,
  createModelProfile,
  getModelProfile,
  updateModelProfile,
  deleteModelProfile,
} from "@/lib/db/model-profiles";
import { routeModelById } from "@/lib/models/router";
import type { ModelProvider, ModelRole } from "@/lib/utils/types";
import { decryptApiKey } from "@/lib/utils/crypto";

export async function GET() {
  const profiles = listModelProfiles();
  // Return profiles with masked API keys
  const masked = profiles.map(p => ({
    ...p,
    api_key: maskKey(p.api_key),
  }));
  return NextResponse.json({ profiles: masked });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    provider: ModelProvider;
    base_url: string;
    api_key: string;
    model: string;
    assigned_roles?: ModelRole[];
    params?: { temperature: number; max_tokens: number };
  };

  if (!body.name || !body.provider || !body.base_url || !body.api_key || !body.model) {
    return NextResponse.json({ error: "error.missing_required_fields" }, { status: 400 });
  }

  const profile = createModelProfile(body);
  return NextResponse.json({ profile: { ...profile, api_key: maskKey(profile.api_key) } }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { id: string } & Record<string, unknown>;
  const { id, ...attrs } = body;

  if (!id) {
    return NextResponse.json({ error: "error.missing_id" }, { status: 400 });
  }

  const existing = getModelProfile(id);
  if (!existing) {
    return NextResponse.json({ error: "error.profile_not_found" }, { status: 404 });
  }

  // Whitelist allowed fields to prevent arbitrary column injection
  const ALLOWED_FIELDS = ["name", "provider", "base_url", "api_key", "model", "assigned_roles", "params", "is_default", "enabled"];
  const safe: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in attrs) safe[key] = (attrs as Record<string, unknown>)[key];
  }
  updateModelProfile(id, safe);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "error.missing_id" }, { status: 400 });
  }

  deleteModelProfile(id);
  return NextResponse.json({ success: true });
}

// Test connectivity for a specific profile
export async function PATCH(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  const profile = getModelProfile(id);
  if (!profile) {
    return NextResponse.json({ error: "error.profile_not_found" }, { status: 404 });
  }

  const routed = routeModelById(id);
  if (!routed) {
    return NextResponse.json({ error: "error.connection_failed" }, { status: 500 });
  }

  try {
    const response = await routed.adapter.chat({
      messages: [{ role: "user", content: "回复'OK'" }],
      max_tokens: 10,
    });
    return NextResponse.json({ connected: true, response: response?.trim() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ connected: false, error: msg }, { status: 200 });
  }
}

function maskKey(encrypted: string): string {
  // Decrypt and mask: show first 3 and last 4 chars
  try {
    const plain = decryptApiKey(encrypted);
    if (plain.length <= 7) return "****";
    return plain.slice(0, 3) + "****" + plain.slice(-4);
  } catch {
    return "****";
  }
}
