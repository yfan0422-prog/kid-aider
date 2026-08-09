import { createHash } from "crypto";
import path from "path";
import fs from "fs";
import { routeModel } from "@/lib/models/router";

export interface TTSOpts {
  voice?: string;
  speed?: number; // 0.8-1.5, default 1.0
}

export interface TTSResult {
  audioPath: string;
  format: "mp3";
  source: "edge-tts" | "openai" | "cache";
}

const CACHE_DIR = path.join(process.cwd(), "data", "audio", "tts_cache");
const MAX_CACHE_ENTRIES = 100;

// OpenAI TTS built-in voice names. Edge neural voices (e.g. "zh-CN-XiaoxiaoNeural")
// are not accepted by OpenAI, so they are mapped to "nova" on the fallback path.
const OPENAI_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova",
  "sage", "shimmer", "verse", "marin", "cedar",
]);

function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheKey(text: string, voice: string): string {
  return createHash("md5").update(`${text}|${voice}`).digest("hex");
}

function cacheGet(key: string): string | null {
  const p = path.join(CACHE_DIR, `${key}.mp3`);
  if (fs.existsSync(p)) return p;
  return null;
}

function cacheSet(key: string, data: Buffer): string {
  ensureCacheDir();
  // LRU: 超过上限时删除最旧条目
  const files = fs.readdirSync(CACHE_DIR)
    .filter(f => f.endsWith(".mp3"))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);

  if (files.length >= MAX_CACHE_ENTRIES) {
    const toDelete = files.slice(0, files.length - MAX_CACHE_ENTRIES + 1);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(CACHE_DIR, f.name));
    }
  }

  const p = path.join(CACHE_DIR, `${key}.mp3`);
  fs.writeFileSync(p, data);
  return p;
}

// --- Edge TTS ---

async function edgeTTS(text: string, voice: string, speed: number): Promise<Buffer> {
  // Edge TTS 通过 HTTP API 调用（无需 SDK）
  const speedStr = speed !== 1.0 ? ` rate="${speed > 1 ? '+' : ''}${Math.round((speed - 1) * 100)}%"` : "";

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
    <voice name="${voice}">
      <prosody${speedStr}>${escapeXml(text)}</prosody>
    </voice>
  </speak>`;

  // Edge TTS 使用两个请求：第一个获取 endpoint，第二个获取音频
  // 简化实现：直接用已知的 WebSocket 端点格式
  const response = await fetch(
    `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "User-Agent": "Mozilla/5.0 (compatible; Kid-Aider/1.0)",
      },
      body: ssml,
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    throw new Error(`Edge TTS returned ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// --- OpenAI TTS ---

async function openaiTTS(text: string, voice: string, speed: number): Promise<Buffer> {
  const model = routeModel("dialogue");
  if (!model) throw new Error("No model configured for TTS");

  // 仅 OpenAI adapter 支持 TTS；Anthropic adapter 无 speech 方法
  const adapter = model.adapter;
  if (!("speech" in adapter)) {
    throw new Error("OpenAI model does not support TTS");
  }

  // OpenAI TTS 只接受其内置 voice 名；Edge 神经网络声（如 zh-CN-XiaoxiaoNeural）映射到 nova
  const openaiVoice = OPENAI_VOICES.has(voice) ? voice : "nova";
  return adapter.speech(text, openaiVoice, speed);
}

// --- Public API ---

export async function synthesizeSpeech(
  text: string,
  opts: TTSOpts = {}
): Promise<TTSResult> {
  const voice = opts.voice || "zh-CN-XiaoxiaoNeural";
  const speed = opts.speed ?? 1.0;
  const truncated = text.slice(0, 500); // 费用控制

  // 检查缓存
  const key = cacheKey(truncated, voice);
  const cached = cacheGet(key);
  if (cached) {
    return { audioPath: cached, format: "mp3", source: "cache" };
  }

  // 优先 Edge TTS（免费）
  try {
    const data = await edgeTTS(truncated, voice, speed);
    const filePath = cacheSet(key, data);
    return { audioPath: filePath, format: "mp3", source: "edge-tts" };
  } catch (err) {
    console.warn("[tts] Edge TTS failed, falling back to OpenAI:", err);
  }

  // 备选 OpenAI TTS
  try {
    const data = await openaiTTS(truncated, voice, speed);
    const filePath = cacheSet(key, data);
    return { audioPath: filePath, format: "mp3", source: "openai" };
  } catch (err) {
    throw new Error(`TTS synthesis failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
