import { getDb } from "./index";
import type { VoiceSession } from "@/lib/utils/types";
import { v4 as uuid } from "uuid";

export function createVoiceSession(attrs: {
  sessionId?: string | null;
  audioPath: string;
  transcript?: string | null;
  asrModel: string;
  asrTimeMs?: number | null;
}): VoiceSession {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  db.prepare(`
    INSERT INTO voice_sessions (id, session_id, audio_path, transcript, asr_model, asr_time_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, attrs.sessionId ?? null, attrs.audioPath, attrs.transcript ?? null,
    attrs.asrModel, attrs.asrTimeMs ?? null, now);
  return {
    id,
    session_id: attrs.sessionId ?? null,
    audio_path: attrs.audioPath,
    transcript: attrs.transcript ?? null,
    asr_model: attrs.asrModel,
    asr_time_ms: attrs.asrTimeMs ?? null,
    created_at: now,
  };
}

export function getVoiceSession(id: string): VoiceSession | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM voice_sessions WHERE id = ?").get(id) as VoiceSession | undefined;
}

export function deleteOldRecordings(daysToKeep = 30): number {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM voice_sessions
    WHERE created_at < datetime('now', ? || ' days')
  `).run(`-${daysToKeep}`);
  return result.changes;
}
