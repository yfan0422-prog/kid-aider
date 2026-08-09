import { getDb } from "./index";
import { v4 as uuid } from "uuid";
import type {
  TopicCatalog,
  TopicContent,
  TopicSuggestion,
  TopicLanguage,
  TopicCategory,
  AgeGroup,
  Challenge,
} from "@/lib/utils/types";

// ─── topic_catalog ──────────────────────────────────────────────

export function createTopic(attrs: {
  title: string;
  summary: string;
  cover_image?: string;
  category: string;
  age_group: string;
  language: string;
  interest_tag?: string;
  source?: string;
  sort_order?: number;
}): TopicCatalog {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(`
    INSERT INTO topic_catalog (id, title, summary, cover_image, category, age_group, language, interest_tag, source, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    attrs.title,
    attrs.summary,
    attrs.cover_image ?? null,
    attrs.category,
    attrs.age_group,
    attrs.language,
    attrs.interest_tag ?? null,
    attrs.source ?? "manual",
    attrs.sort_order ?? 0,
    now,
    now,
  );
  return getTopic(id)!;
}

export function getTopic(id: string): TopicCatalog | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM topic_catalog WHERE id = ?").get(id) as TopicCatalog | undefined;
}

export function updateTopic(
  id: string,
  fields: Partial<Pick<TopicCatalog, "title" | "summary" | "cover_image" | "category" | "age_group" | "interest_tag" | "sort_order" | "is_active">>
): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(", ");
  const values = keys.map(k => (fields as Record<string, unknown>)[k]);
  db.prepare(`UPDATE topic_catalog SET ${setClause}, updated_at = ? WHERE id = ?`)
    .run(...values, now, id);
}

export function softDeleteTopic(id: string): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare("UPDATE topic_catalog SET is_active = 0, updated_at = ? WHERE id = ?").run(now, id);
}

export function listTopics(filters?: {
  age?: string;
  category?: string;
  language?: string;
  source?: string;
  isActive?: boolean;
}): TopicCatalog[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters) {
    if (filters.age) {
      conditions.push("(age_group = ? OR age_group = 'all')");
      params.push(filters.age);
    }
    if (filters.category) {
      conditions.push("category = ?");
      params.push(filters.category);
    }
    if (filters.language) {
      conditions.push("language = ?");
      params.push(filters.language);
    }
    if (filters.source) {
      conditions.push("source = ?");
      params.push(filters.source);
    }
    if (filters.isActive !== undefined) {
      conditions.push("is_active = ?");
      params.push(filters.isActive ? 1 : 0);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM topic_catalog ${where} ORDER BY sort_order ASC, created_at DESC`).all(...params) as TopicCatalog[];
}

// ─── topic_contents ─────────────────────────────────────────────

export function getActiveContent(
  topicId: string,
  ageGroup: string,
  language: string
): TopicContent | undefined {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM topic_contents WHERE topic_id = ? AND age_group = ? AND language = ? AND is_active = 1"
  ).get(topicId, ageGroup, language) as TopicContent | undefined;
}

export function createTopicContent(attrs: {
  topic_id: string;
  age_group: string;
  language: string;
  version: number;
  intro_text: string;
  challenges: Challenge[];
  project_prompt?: string;
  image_prompts?: { section: string; prompt: string }[];
  generation_rule_version: string;
}): TopicContent {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();

  // Deactivate all existing versions for this topic+age+language combo
  db.prepare(
    "UPDATE topic_contents SET is_active = 0 WHERE topic_id = ? AND age_group = ? AND language = ?"
  ).run(attrs.topic_id, attrs.age_group, attrs.language);

  db.prepare(`
    INSERT INTO topic_contents (id, topic_id, age_group, language, version, intro_text, challenges, project_prompt, image_prompts, generation_rule_version, is_active, generated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    attrs.topic_id,
    attrs.age_group,
    attrs.language,
    attrs.version,
    attrs.intro_text,
    JSON.stringify(attrs.challenges),
    attrs.project_prompt ?? null,
    attrs.image_prompts ? JSON.stringify(attrs.image_prompts) : null,
    attrs.generation_rule_version,
    now,
    now,
  );

  return db.prepare("SELECT * FROM topic_contents WHERE id = ?").get(id) as TopicContent;
}

export function getContentVersions(
  topicId: string,
  ageGroup: string,
  language: string
): TopicContent[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM topic_contents WHERE topic_id = ? AND age_group = ? AND language = ? ORDER BY version DESC"
  ).all(topicId, ageGroup, language) as TopicContent[];
}

export function activateVersion(versionId: string): void {
  const db = getDb();
  const content = db.prepare("SELECT * FROM topic_contents WHERE id = ?").get(versionId) as TopicContent | undefined;
  if (!content) return;

  // Deactivate all for this topic+age+language
  db.prepare(
    "UPDATE topic_contents SET is_active = 0 WHERE topic_id = ? AND age_group = ? AND language = ?"
  ).run(content.topic_id, content.age_group, content.language);

  // Activate the chosen version
  db.prepare("UPDATE topic_contents SET is_active = 1 WHERE id = ?").run(versionId);
}

export function deleteVersion(versionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM topic_contents WHERE id = ?").run(versionId);
}

export function getLatestVersionNumber(
  topicId: string,
  ageGroup: string,
  language: string
): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT MAX(version) as max_ver FROM topic_contents WHERE topic_id = ? AND age_group = ? AND language = ?"
  ).get(topicId, ageGroup, language) as { max_ver: number | null };
  return row?.max_ver ?? 0;
}

// ─── topic_suggestions ──────────────────────────────────────────

export function createSuggestion(attrs: {
  interest_tag: string;
  candidate_title: string;
  viability_score: number;
  viability_reason?: string;
}): TopicSuggestion {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const id = uuid();
  db.prepare(`
    INSERT INTO topic_suggestions (id, interest_tag, candidate_title, viability_score, viability_reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, attrs.interest_tag, attrs.candidate_title, attrs.viability_score, attrs.viability_reason ?? null, now);
  return {
    id,
    interest_tag: attrs.interest_tag,
    candidate_title: attrs.candidate_title,
    viability_score: attrs.viability_score,
    viability_reason: attrs.viability_reason ?? null,
    status: "pending",
    reviewed_at: null,
    created_at: now,
  };
}

export function getPendingSuggestions(): TopicSuggestion[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM topic_suggestions WHERE status = 'pending' ORDER BY viability_score DESC, created_at DESC"
  ).all() as TopicSuggestion[];
}

export function reviewSuggestion(id: string, status: "approved" | "rejected"): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare("UPDATE topic_suggestions SET status = ?, reviewed_at = ? WHERE id = ?")
    .run(status, now, id);
}
