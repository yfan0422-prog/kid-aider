import { createHash, randomBytes, randomUUID } from "crypto";
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

function cacheKey(text: string, voice: string, speed: number): string {
  // speed 影响合成音频，必须参与缓存键，否则不同语速会命中同一份缓存
  return createHash("md5").update(`${text}|${voice}|${speed}`).digest("hex");
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
// 协议实现参照 edge-tts 7.2.8（rany2/edge-tts）：
//   1. 以浏览器式头部建立 WebSocket 连接（wss 升级请求携带 Origin/User-Agent/Cookie:muid）
//   2. URL 附带 Sec-MS-GEC 反滥用令牌（SHA-256，5 分钟窗口，大写十六进制）
//   3. 发送 speech.config 与 ssml 两条文本帧（X-Timestamp 需带 "Z" 后缀，微软已知 bug）
//   4. 服务端以文本帧发送元数据（Path:turn.end 表示结束），以二进制帧发送音频（Path:audio）
//   5. 超时或任意异常均向上抛出，由 synthesizeSpeech 的 try/catch 链回退到 OpenAI

const EDGE_TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const EDGE_TIMEOUT_MS = 5000;
// edge-tts 7.2.8 使用的 Chromium 版本串
const EDGE_SEC_MS_GEC_VERSION = "1-143.0.3650.75";

const EDGE_WS_HEADERS = {
  Pragma: "no-cache",
  "Cache-Control": "no-cache",
  Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9",
  Cookie: `muid=${randomBytes(16).toString("hex").toUpperCase()};`,
};

// 生成 Sec-MS-GEC 令牌，与 edge-tts 7.2.8 的 DRM.generate_sec_ms_gec 逐位一致：
// unix 秒 → 加 Windows 文件时间纪元偏移(1601) → 向下取整到 5 分钟 → 乘 1e7 转 100ns 间隔
// → 拼接 TrustedClientToken → SHA-256 → 大写 hex
function generateSecMsGec(): string {
  let ticks = Date.now() / 1000;
  ticks += 11644473600;
  ticks -= ticks % 300;
  ticks *= 1e7;
  const strToHash = `${ticks.toFixed(0)}${EDGE_TRUSTED_CLIENT_TOKEN}`;
  return createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}

function edgeWsUrl(): string {
  return `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${generateSecMsGec()}&Sec-MS-GEC-Version=${EDGE_SEC_MS_GEC_VERSION}`;
}

// 服务端返回的是 "Sun Aug 09 2026 10:35:00 GMT+0000 (Coordinated Universal Time)" 形态
function edgeTimestamp(): string {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

// 服务不支持若干控制字符（尤其垂直制表符），替换为空格
function removeControlChars(s: string): string {
  return Array.from(s).map(c => {
    const code = c.codePointAt(0)!;
    if ((code >= 0 && code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31)) return " ";
    return c;
  }).join("");
}

// 连续的下划线（如填空模板 "____"）在朗读时会被逐个读成「下划线」，
// 这里合并为单个「空格」表述，避免重复播报。
function normalizeForSpeech(s: string): string {
  return s.replace(/_+/g, "空格");
}

async function edgeTTS(text: string, voice: string, speed: number): Promise<Buffer> {
  const rate = `${speed > 1 ? "+" : ""}${Math.round((speed - 1) * 100)}%`;
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapeXml(removeControlChars(text))}</prosody></voice></speak>`;
  const config = `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},"outputFormat":"${EDGE_OUTPUT_FORMAT}"}}}}\r\n`;

  const requestId = randomUUID().replace(/-/g, "");
  const timestamp = edgeTimestamp();

  return new Promise<Buffer>((resolve, reject) => {
    const audioChunks: Buffer[] = [];
    let settled = false;
    let timer: NodeJS.Timeout;
    let ws: WebSocket;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* ignore */ }
      reject(err);
    };

    // 服务端在最后一个音频帧后发送 Path:turn.end 文本帧；收到即收集完成
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* ignore */ }
      if (audioChunks.length === 0) {
        reject(new Error("Edge TTS returned no audio"));
      } else {
        resolve(Buffer.concat(audioChunks));
      }
    };

    const handleBinary = (buf: Buffer) => {
      // 音频帧头部以 "Path:audio\r\n" 结尾，其后的字节即原始 MP3 音频（无 \r\n\r\n 分隔符）
      const audioMarker = "Path:audio\r\n";
      const idx = buf.indexOf(audioMarker);
      if (idx < 0) return; // 非音频二进制帧（无 Path:audio 头部）忽略
      const audio = buf.subarray(idx + audioMarker.length);
      if (audio.length > 0) audioChunks.push(audio);
    };

    // 活动式超时：每次收到消息都重置计时器
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fail(new Error("Edge TTS timed out")), EDGE_TIMEOUT_MS);
    };

    try {
      // undici 的 WebSocket 接受 { headers } 作为第二参数，但 TS lib.dom 类型未覆盖，故断言
      ws = new WebSocket(edgeWsUrl(), { headers: EDGE_WS_HEADERS } as unknown as string | string[]);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    // 二进制消息以 ArrayBuffer 同步到达，避免 Blob 异步转换在 turn.end 前未完成的竞态
    ws.binaryType = "arraybuffer";
    resetTimer();

    ws.addEventListener("open", () => {
      ws.send(`X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${config}`);
      ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      const data = event.data;
      resetTimer();
      if (typeof data === "string") {
        // 文本帧：解析头部，Path:turn.end 表示合成结束
        const sep = data.indexOf("\r\n\r\n");
        if (sep < 0) return;
        const headerBlock = data.slice(0, sep);
        const pathMatch = headerBlock.match(/(?:^|\r\n)Path:([^\r\n]*)/);
        if (pathMatch && pathMatch[1].trim() === "turn.end") finish();
        return;
      }
      if (data instanceof Blob) {
        data.arrayBuffer().then(ab => handleBinary(Buffer.from(ab)));
      } else if (data instanceof ArrayBuffer) {
        handleBinary(Buffer.from(data));
      } else if (ArrayBuffer.isView(data)) {
        handleBinary(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
      }
    });

    ws.addEventListener("close", (event: CloseEvent) => {
      if (settled) return;
      // 服务端在 turn.end 之后主动关闭：若已收到音频则按音频处理，否则视为失败
      if (audioChunks.length > 0) finish();
      else fail(new Error(`Edge TTS closed without audio (code ${event.code})`));
    });

    ws.addEventListener("error", () => {
      fail(new Error("Edge TTS WebSocket error"));
    });
  });
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
  const truncated = normalizeForSpeech(text).slice(0, 500); // 费用控制

  // 检查缓存
  const key = cacheKey(truncated, voice, speed);
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
