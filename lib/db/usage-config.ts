import { getDb } from "./index";
import type { UsageConfig } from "@/lib/utils/types";

export function getUsageConfig(): UsageConfig {
  const db = getDb();
  const row = db.prepare("SELECT * FROM usage_config WHERE id = 1").get();
  return row as UsageConfig;
}

export function updateUsageConfig(attrs: Partial<Pick<UsageConfig, "daily_limit_min" | "quiet_start" | "quiet_end" | "filter_enabled" | "restrictions_paused">>): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  db.prepare(`UPDATE usage_config SET ${fields.join(", ")} WHERE id = 1`).run(...values);
}
