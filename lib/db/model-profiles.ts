import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import { encryptApiKey } from "@/lib/utils/crypto";
import type { ModelProfile, ModelProvider, ModelRole } from "@/lib/utils/types";

interface CreateAttrs {
  name: string;
  provider: ModelProvider;
  base_url: string;
  api_key: string; // plain text input
  model: string;
  assigned_roles?: ModelRole[];
  params?: { temperature: number; max_tokens: number };
  enabled?: boolean;
}

export function createModelProfile(attrs: CreateAttrs): ModelProfile {
  const db = getDb();
  const now = new Date().toISOString();
  // First profile auto-becomes default
  const existingCount = (db.prepare("SELECT COUNT(*) as count FROM model_profiles").get() as { count: number }).count;
  const profile: ModelProfile = {
    id: uuid(),
    name: attrs.name,
    provider: attrs.provider,
    base_url: attrs.base_url,
    api_key: encryptApiKey(attrs.api_key),
    model: attrs.model,
    assigned_roles: attrs.assigned_roles || ["dialogue"],
    params: attrs.params || { temperature: 0.7, max_tokens: 2048 },
    is_default: existingCount === 0,
    enabled: attrs.enabled !== undefined ? attrs.enabled : true,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO model_profiles (id, name, provider, base_url, api_key, model, assigned_roles, params, is_default, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(profile.id, profile.name, profile.provider, profile.base_url, profile.api_key, profile.model, JSON.stringify(profile.assigned_roles), JSON.stringify(profile.params), profile.is_default ? 1 : 0, profile.enabled ? 1 : 0, profile.created_at, profile.updated_at);
  return profile;
}

export function listModelProfiles(): ModelProfile[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM model_profiles ORDER BY created_at DESC").all() as Array<Record<string, unknown>>;
  return rows.map(deserializeProfile);
}

export function getModelProfile(id: string): ModelProfile | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM model_profiles WHERE id = ?").get(id);
  return row ? deserializeProfile(row as Record<string, unknown>) : undefined;
}

export function getDefaultProfile(role?: ModelRole): ModelProfile | undefined {
  const db = getDb();
  // Prefer profiles explicitly marked as default (only enabled ones)
  let rows = db.prepare("SELECT * FROM model_profiles WHERE is_default = 1 AND enabled = 1").all() as Array<Record<string, unknown>>;
  // Fall back to all enabled profiles if no explicit default
  if (rows.length === 0) {
    rows = db.prepare("SELECT * FROM model_profiles WHERE enabled = 1 ORDER BY created_at ASC").all() as Array<Record<string, unknown>>;
  }
  const profiles = rows.map(deserializeProfile);
  if (!role) return profiles[0];
  return profiles.find(p => p.assigned_roles.includes(role)) || profiles[0];
}

export function updateModelProfile(id: string, attrs: Partial<CreateAttrs & { is_default: boolean; enabled: boolean }>): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) {
      if (k === "api_key") {
        fields.push("api_key = ?");
        values.push(encryptApiKey(v as string));
      } else if (k === "assigned_roles" || k === "params") {
        fields.push(`${k} = ?`);
        values.push(JSON.stringify(v));
      } else if (k === "is_default" || k === "enabled") {
        fields.push(`${k} = ?`);
        values.push(v ? 1 : 0);
      } else {
        fields.push(`${k} = ?`);
        values.push(v);
      }
    }
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE model_profiles SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteModelProfile(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM model_profiles WHERE id = ?").run(id);
}

function deserializeProfile(row: Record<string, unknown>): ModelProfile {
  return {
    ...row,
    assigned_roles: JSON.parse(row.assigned_roles as string),
    params: JSON.parse(row.params as string),
    is_default: Boolean(row.is_default),
    enabled: row.enabled === undefined ? true : Boolean(row.enabled),
  } as ModelProfile;
}
