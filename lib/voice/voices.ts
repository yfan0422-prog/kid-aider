// lib/voice/voices.ts

export type VoiceStyle = {
  id: string; // Edge TTS 音色全名
  key: string; // i18n 标签键（settings.voice.v.*）
};

export const VOICES: VoiceStyle[] = [
  { id: "zh-CN-XiaoxiaoNeural", key: "settings.voice.v.xiaoxiao" },
  { id: "zh-CN-XiaoyiNeural", key: "settings.voice.v.xiaoyi" },
  { id: "zh-CN-YunxiNeural", key: "settings.voice.v.yunxi" },
  { id: "zh-CN-YunxiaNeural", key: "settings.voice.v.yunxia" },
  { id: "zh-CN-YunyangNeural", key: "settings.voice.v.yunyang" },
];

export const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";

const STORAGE_KEY = "kid-aider-voice";

const VALID_IDS = new Set(VOICES.map((v) => v.id));

export function getStoredVoice(): string {
  if (typeof window === "undefined") return DEFAULT_VOICE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_IDS.has(stored)) return stored;
  } catch {}
  return DEFAULT_VOICE;
}

export function setStoredVoice(id: string): void {
  if (typeof window === "undefined") return;
  if (!VALID_IDS.has(id)) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}
