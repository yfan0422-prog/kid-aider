import { getDb } from "./index";
import type { EmotionLog } from "@/lib/utils/types";
import { v4 as uuid } from "uuid";

export function createEmotionLog(attrs: {
  sessionId?: string | null;
  source: "voice" | "text" | "fused";
  emotion: string;
  confidence?: number | null;
  voiceFeatures?: string | null;
  textSnippet?: string | null;
  modelUsed?: string;
}): EmotionLog {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare(`
    INSERT INTO emotion_log (id, session_id, source, emotion, confidence, voice_features, text_snippet, model_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, attrs.sessionId ?? null, attrs.source, attrs.emotion,
    attrs.confidence ?? null, attrs.voiceFeatures ?? null, attrs.textSnippet ?? null,
    attrs.modelUsed ?? "rule", now);
  return {
    id,
    session_id: attrs.sessionId ?? null,
    source: attrs.source,
    emotion: attrs.emotion,
    confidence: attrs.confidence ?? null,
    voice_features: attrs.voiceFeatures ?? null,
    text_snippet: attrs.textSnippet ?? null,
    model_used: attrs.modelUsed ?? "rule",
    created_at: now,
  };
}

export function getRecentEmotions(sessionId: string, limit = 5): EmotionLog[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM emotion_log
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(sessionId, limit) as EmotionLog[];
}
