import { getDb } from "./index";
import type { ChildProfile, ProfileUpdate } from "@/lib/utils/types";
import { v4 as uuid } from "uuid";

const DEFAULT_ID = "default";

export function getOrCreateChildProfile(): ChildProfile {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

  const existing = db.prepare("SELECT * FROM child_profile WHERE id = ?").get(DEFAULT_ID) as ChildProfile | undefined;
  if (existing) return existing;

  db.prepare(`
    INSERT INTO child_profile (id, created_at, updated_at)
    VALUES (?, ?, ?)
  `).run(DEFAULT_ID, now, now);

  return db.prepare("SELECT * FROM child_profile WHERE id = ?").get(DEFAULT_ID) as ChildProfile;
}

export function getChildProfile(): ChildProfile | null {
  const db = getDb();
  return db.prepare("SELECT * FROM child_profile WHERE id = ?")
    .get(DEFAULT_ID) as ChildProfile | null;
}

export function updateChildProfile(
  id: string,
  fields: Partial<Omit<ChildProfile, "id" | "created_at" | "updated_at">>
): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(", ");
  const values = keys.map(k => (fields as Record<string, unknown>)[k]);
  db.prepare(`UPDATE child_profile SET ${setClause}, updated_at = ? WHERE id = ?`)
    .run(...values, now, id);
}

export function createProfileUpdate(attrs: {
  trigger: "session_start" | "session_end" | "deep_analysis";
  changes: Record<string, unknown>;
  snapshot?: Partial<ChildProfile> | null;
}): ProfileUpdate {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare(`
    INSERT INTO profile_updates (id, trigger, changes, snapshot, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, attrs.trigger, JSON.stringify(attrs.changes), attrs.snapshot ? JSON.stringify(attrs.snapshot) : null, now);
  return {
    id, trigger: attrs.trigger,
    changes: JSON.stringify(attrs.changes),
    snapshot: attrs.snapshot ? JSON.stringify(attrs.snapshot) : null,
    created_at: now,
  };
}
