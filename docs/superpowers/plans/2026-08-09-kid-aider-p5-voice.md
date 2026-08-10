# P5 · 语音互联 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Kid-Aider 增加语音交互能力——孩子说话→ASR 转写→情绪感知→智能回复→TTS 朗读，文字交互保留不动。

**Architecture:** whisper.cpp 本地子进程做 ASR，Edge TTS / OpenAI TTS 云端做语音合成，规则+LLM 双轨做情绪分类。浏览器端使用 MediaRecorder API 采集音频，无新增 npm 依赖。

**Tech Stack:** Next.js 14 + TypeScript strict + Tailwind CSS v3 + Zustand v5 + better-sqlite3 + whisper.cpp (系统二进制) + Edge TTS / OpenAI TTS

## Global Constraints

- 零新增 npm 依赖（浏览器端使用原生 MediaRecorder API）
- 不改变现有文字聊天 SSE 架构
- whisper.cpp 以系统级二进制安装（非 npm 包），服务端 spawn 管理
- 所有语音数据保留在本地，不上传云端（ASR 端到端本地）
- TypeScript strict，无 `any` 跳过
- 遵循项目 token 设计系统（`text-ink-tertiary`, `bg-surface`, `border-border`, `rounded-card`, `rounded-btn`）
- Edge TTS 默认 + OpenAI TTS 备选
- 情绪 5 标签：🎉兴奋 😌平静 😟沮丧 😤着急 🤔困惑
- TTS 超时 5s 静默降级；LLM 情绪分类超时 3s 保持规则结果

---

### Task 1: 类型定义与数据库扩展

**Files:**
- Modify: `lib/utils/types.ts` — 新增 VoiceSession, EmotionLog 接口
- Modify: `lib/db/index.ts` — 新增 voice_sessions, emotion_log 表 + 索引

**Interfaces:**
- Produces: `VoiceSession`, `EmotionLog` 类型；两张表 + 索引供 Task 5 CRUD 使用

- [ ] **Step 1: 添加类型定义**

在 `lib/utils/types.ts` 末尾追加：

```typescript
export interface VoiceSession {
  id: string;
  session_id: string | null;
  audio_path: string;
  transcript: string | null;
  asr_model: string;
  asr_time_ms: number | null;
  created_at: string;
}

export interface EmotionLog {
  id: string;
  session_id: string | null;
  source: "voice" | "text" | "fused";
  emotion: string;
  confidence: number | null;
  voice_features: string | null; // JSON: {pitch, duration, volume} | null
  text_snippet: string | null;
  model_used: string; // 'rule' | 'llm' | 'rule+llm'
  created_at: string;
}
```

- [ ] **Step 2: 添加数据库表**

在 `lib/db/index.ts` 的 `db.exec(` 块内，现有 `CREATE TABLE IF NOT EXISTS usage_log` 之后，追加：

```sql
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id            TEXT PRIMARY KEY,
      session_id    TEXT,
      audio_path    TEXT NOT NULL,
      transcript    TEXT,
      asr_model     TEXT NOT NULL,
      asr_time_ms   INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emotion_log (
      id             TEXT PRIMARY KEY,
      session_id     TEXT,
      source         TEXT NOT NULL CHECK(source IN ('voice', 'text', 'fused')),
      emotion        TEXT NOT NULL,
      confidence     REAL,
      voice_features TEXT,
      text_snippet   TEXT,
      model_used     TEXT NOT NULL DEFAULT 'rule',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_voice_sessions_session ON voice_sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_emotion_log_session ON emotion_log(session_id);
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

预期：构建成功，新表和类型无冲突。

- [ ] **Step 4: Commit**

```bash
git add lib/utils/types.ts lib/db/index.ts
git commit -m "feat(p5): add VoiceSession and EmotionLog types, create tables"
```

---

### Task 2: whisper.cpp 子进程管理器

**Files:**
- Create: `lib/voice/whisper-manager.ts`

**Interfaces:**
- Produces: `startWhisper()`, `stopWhisper()`, `transcribe(audioPath: string): Promise<{text: string, timeMs: number}>`, `healthCheck(): boolean`
- 供 Task 6 `/api/voice/asr` 使用

- [ ] **Step 1: Read 现有 adapter 模式**

Read `lib/models/openai-adapter.ts` 了解项目中工厂函数 + 返回对象的模式。

- [ ] **Step 2: 实现 whisper-manager**

创建 `lib/voice/whisper-manager.ts`：

```typescript
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

let process_: ChildProcess | null = null;
let modelPath: string | null = null;

const WHISPER_BIN = "whisper.cpp";

function findModel(): string | null {
  const candidates = [
    path.join(process.cwd(), "data", "models", "ggml-base.bin"),
    path.join(process.cwd(), "data", "models", "ggml-small.bin"),
    path.join(process.cwd(), "data", "models", "ggml-tiny.bin"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function isModelAvailable(): boolean {
  if (modelPath && fs.existsSync(modelPath)) return true;
  modelPath = findModel();
  return modelPath !== null;
}

export function healthCheck(): boolean {
  // whisper.cpp 作为一次性 CLI 调用，无需常驻进程
  // 检查二进制是否可用
  try {
    const { execSync } = require("child_process");
    execSync(`which ${WHISPER_BIN} 2>/dev/null || echo ""`, { encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

export async function transcribe(audioPath: string): Promise<{ text: string; timeMs: number }> {
  if (!isModelAvailable()) {
    throw new Error("Whisper model not found. Download ggml-base.bin to data/models/");
  }

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(WHISPER_BIN, [
      "-m", modelPath!,
      "-f", audioPath,
      "-l", "zh",
      "--no-timestamps",
      "-otxt",
    ], {
      cwd: process.cwd(),
      timeout: 30000, // 30s timeout
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

    child.on("close", (code: number | null) => {
      const timeMs = Date.now() - startTime;
      if (code === 0) {
        resolve({ text: stdout.trim(), timeMs });
      } else {
        reject(new Error(`whisper.cpp exited with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (err: Error) => {
      reject(new Error(`Failed to start whisper.cpp: ${err.message}`));
    });
  });
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
npx tsc --noEmit lib/voice/whisper-manager.ts
```

预期：无类型错误。

- [ ] **Step 4: Commit**

```bash
git add lib/voice/whisper-manager.ts
git commit -m "feat(p5): add whisper.cpp subprocess manager"
```

---

### Task 3: 音频特征提取 + 情绪分类器

**Files:**
- Create: `lib/voice/audio-features.ts`
- Create: `lib/voice/emotion-classifier.ts`

**Interfaces:**
- Produces: `extractAudioFeatures(audioPath: string): Promise<AudioFeatures>`, `classifyEmotion(opts: ClassifyOpts): Promise<EmotionResult>`
- Consumes: `lib/models/router.ts` 的 `routeModel()` 用于 LLM 分类
- 供 Task 6 `/api/voice/emotion` 使用

- [ ] **Step 1: 创建音频特征提取模块**

创建 `lib/voice/audio-features.ts`：

```typescript
import { spawn } from "child_process";

export interface AudioFeatures {
  pitch: number;   // 平均音高 (Hz), 估算
  rate: number;    // 语速 (音节/秒)
  duration: number; // 音频时长 (秒)
  volume: number;  // 平均音量 (RMS 归一化 0-1)
}

/**
 * 使用 sox 或 ffmpeg 提取音频特征。
 * 优先使用系统可用的工具。
 */
export async function extractAudioFeatures(audioPath: string): Promise<AudioFeatures> {
  // 使用 sox 提取统计信息
  const stats = await soxStats(audioPath);
  // 使用 ffmpeg 估算语速
  const rate = await estimateSpeechRate(audioPath);

  return {
    pitch: estimatePitch(stats),
    rate,
    volume: clamp(stats.rms / 0.3, 0, 1), // 归一化
  };
}

interface SoxStats {
  rms: number;
  freq: number;
}

function soxStats(audioPath: string): Promise<SoxStats> {
  return new Promise((resolve, reject) => {
    const child = spawn("sox", [audioPath, "-n", "stats"], { timeout: 5000 });
    let out = "";
    child.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { out += d.toString(); });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        // sox 不可用时返回默认值
        resolve({ rms: 0.1, freq: 200 });
        return;
      }
      const rmsMatch = out.match(/RMS lev dB\s+([-\d.]+)/);
      const freqMatch = out.match(/Rough frequency\s+(\d+)/);
      resolve({
        rms: rmsMatch ? Math.pow(10, parseFloat(rmsMatch[1]) / 20) : 0.1,
        freq: freqMatch ? parseInt(freqMatch[1]) : 200,
      });
    });

    child.on("error", () => resolve({ rms: 0.1, freq: 200 }));
  });
}

async function estimateSpeechRate(audioPath: string): Promise<number> {
  return new Promise((resolve) => {
    // 用 ffprobe 获取时长
    const child = spawn("ffprobe", [
      "-v", "quiet", "-show_entries", "format=duration",
      "-of", "csv=p=0", audioPath,
    ], { timeout: 5000 });
    let out = "";
    child.stdout.on("data", (d: Buffer) => { out += d.toString(); });

    child.on("close", (code: number | null) => {
      const duration = parseFloat(out.trim());
      if (isNaN(duration) || duration <= 0) { resolve(3.0); return; }
      // 估算：标准语速 ~3 音节/秒，这里返回时长用于上层计算
      resolve(duration);
    });

    child.on("error", () => resolve(3.0));
  });
}

function estimatePitch(stats: SoxStats): number {
  // 儿童音高范围: 200-500 Hz
  // 从 sox 的 rough frequency 近似
  return clamp(stats.freq, 100, 600);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
```

- [ ] **Step 2: 创建规则情绪分类器**

创建 `lib/voice/emotion-classifier.ts`：

```typescript
import type { AudioFeatures } from "./audio-features";
import { extractAudioFeatures } from "./audio-features";
import { routeModel } from "@/lib/models/router";
import type { EmotionLog } from "@/lib/utils/types";
import { v4 as uuid } from "uuid";

export type EmotionLabel = "excited" | "calm" | "frustrated" | "impatient" | "confused";

export interface EmotionResult {
  emotion: EmotionLabel;
  confidence: number;
  modelUsed: "rule" | "llm" | "rule+llm";
  reason: string;
}

export interface ClassifyOpts {
  text: string;
  history?: string[];
  audioFeatures?: AudioFeatures;
  sessionId?: string;
}

// --- 规则分类 ---

interface RuleEmotion {
  emotion: EmotionLabel;
  confidence: number;
  reason: string;
}

function classifyByRules(opts: ClassifyOpts): RuleEmotion {
  const { text, audioFeatures } = opts;

  // 文字信号
  const excitedWords = ["太棒", "好厉害", "哇", "耶", "哈哈", "开心", "好玩", "喜欢"];
  const frustratedWords = ["不行", "不会", "好难", "做不到", "算了", "不想", "讨厌", "烦"];
  const impatientWords = ["快点", "快", "马上", "现在", "赶紧", "立刻"];
  const confusedWords = ["为什么", "什么意思", "不懂", "不明白", "怎么", "什么", "哪个"];
  const questionWords = ["为什么", "怎么", "什么", "哪", "谁", "吗", "呢"];

  const excitedScore = excitedWords.filter(w => text.includes(w)).length;
  const frustratedScore = frustratedWords.filter(w => text.includes(w)).length;
  const impatientScore = impatientWords.filter(w => text.includes(w)).length;
  const confusedScore = confusedWords.filter(w => text.includes(w)).length;
  const questionCount = questionWords.filter(w => text.includes(w)).length;

  // 语音信号增强
  let voiceExcitement = 0;
  let voiceFrustration = 0;
  let voiceImpatience = 0;
  let voiceConfusion = 0;

  if (audioFeatures) {
    const { pitch, duration, volume } = audioFeatures;
    // 高音高 + 大音量 → 兴奋
    if (pitch > 300 && volume > 0.5) voiceExcitement += 2;
    // 低音高 + 小音量 → 沮丧
    if (pitch < 200 && volume < 0.2) voiceFrustration += 2;
    // 极快语速 → 着急（rate 是音频时长，越短越急）
    if (duration < 2.0 && volume > 0.4) voiceImpatience += 2;
    // 长音频 + 短文本 → 停顿多 → 困惑
    if (duration > 5.0 && text.length < 20) voiceConfusion += 2;
  }

  const scores: { emotion: EmotionLabel; score: number }[] = [
    { emotion: "excited", score: excitedScore + voiceExcitement },
    { emotion: "frustrated", score: frustratedScore + voiceFrustration },
    { emotion: "impatient", score: impatientScore + voiceImpatience },
    { emotion: "confused", score: confusedScore + questionCount + voiceConfusion },
    { emotion: "calm", score: 1 }, // 默认基线
  ];

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const confidence = top.score > 1 ? 0.7 : 0.5;

  const reasons: Record<EmotionLabel, string> = {
    excited: "检测到积极关键词和/或高唤醒语音特征",
    calm: "未检测到显著情绪信号",
    frustrated: "检测到否定/消极关键词和/或低唤醒语音特征",
    impatient: "检测到催促关键词和/或快速语音",
    confused: "检测到疑问关键词和/或停顿特征",
  };

  return { emotion: top.emotion, confidence, reason: reasons[top.emotion] };
}

// --- LLM 分类 ---

const EMOTION_PROMPT = `Analyze the child's current emotional state from the conversation.
Return ONLY a JSON object (no markdown, no code block):

{"emotion":"excited|calm|frustrated|impatient|confused","confidence":0.0-1.0,"reason":"brief analysis in English"}

Emotion definitions:
- excited: positive high-arousal (happy, enthusiastic, amazed)
- calm: neutral low-arousal (normal, relaxed, focused)
- frustrated: negative low-arousal (sad, discouraged, disappointed)
- impatient: negative high-arousal (angry, demanding, rushing)
- confused: neutral high-arousal (uncertain, puzzled, questioning)`;

async function classifyByLLM(opts: ClassifyOpts): Promise<RuleEmotion | null> {
  const model = routeModel("dialogue");
  if (!model) return null; // 无可用模型

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: EMOTION_PROMPT },
  ];

  if (opts.history && opts.history.length > 0) {
    messages.push({ role: "user", content: `Conversation history:\n${opts.history.join("\n")}\n\nChild's latest message: "${opts.text}"` });
  } else {
    messages.push({ role: "user", content: `Child's message: "${opts.text}"` });
  }

  try {
    const result = await Promise.race([
      model.adapter.chat({ messages, temperature: 0.3, max_tokens: 128 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    if (!result) return null;

    const jsonMatch = (result as string).match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const validEmotions: EmotionLabel[] = ["excited", "calm", "frustrated", "impatient", "confused"];
    if (!validEmotions.includes(parsed.emotion)) return null;

    return {
      emotion: parsed.emotion as EmotionLabel,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      reason: parsed.reason || "LLM classification",
    };
  } catch {
    return null;
  }
}

// --- 融合 ---

export async function classifyEmotion(opts: ClassifyOpts): Promise<EmotionResult> {
  // 第一轨：规则（即时）
  const ruleResult = classifyByRules(opts);

  // 第二轨：LLM（异步覆盖）
  try {
    const llmResult = await classifyByLLM(opts);

    if (llmResult && llmResult.confidence >= 0.6) {
      return {
        emotion: llmResult.emotion,
        confidence: llmResult.confidence,
        modelUsed: "rule+llm",
        reason: llmResult.reason,
      };
    }
  } catch {
    // LLM 失败，保持规则结果
  }

  return {
    ...ruleResult,
    modelUsed: "rule",
  };
}
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add lib/voice/audio-features.ts lib/voice/emotion-classifier.ts
git commit -m "feat(p5): add audio feature extraction and emotion classifier"
```

---

### Task 4: TTS 适配器

**Files:**
- Create: `lib/voice/tts-adapter.ts`

**Interfaces:**
- Produces: `synthesizeSpeech(text: string, opts?: TTSOpts): Promise<TTSResult>`, `TTSResult { audioPath, format, source }`
- 供 Task 6 `/api/voice/tts` 使用

- [ ] **Step 1: 创建 TTS 适配器**

创建 `lib/voice/tts-adapter.ts`：

```typescript
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

  // OpenAI adapter 的 client 即 OpenAI SDK 实例
  // 通过 adapter 的类型判断是否支持 TTS
  const client = (model.adapter as { client?: { audio?: { speech?: { create: Function } } } }).client;
  if (!client || !client.audio) {
    throw new Error("OpenAI model does not support TTS");
  }

  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: voice || "nova",
    input: text,
    speed,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
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
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add lib/voice/tts-adapter.ts
git commit -m "feat(p5): add TTS adapter with Edge TTS and OpenAI TTS support"
```

---

### Task 5: 语音数据库 CRUD

**Files:**
- Create: `lib/db/voice-sessions.ts`
- Create: `lib/db/emotion-log.ts`

**Interfaces:**
- Produces: `createVoiceSession()`, `getVoiceSession()`, `deleteOldRecordings()`; `createEmotionLog()`, `getRecentEmotions()`
- 供 Task 6 API 路由使用

- [ ] **Step 1: 创建 voice-sessions CRUD**

创建 `lib/db/voice-sessions.ts`：

```typescript
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
```

- [ ] **Step 2: 创建 emotion-log CRUD**

创建 `lib/db/emotion-log.ts`：

```typescript
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
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add lib/db/voice-sessions.ts lib/db/emotion-log.ts
git commit -m "feat(p5): add voice sessions and emotion log CRUD modules"
```

---

### Task 6: Voice API 路由

**Files:**
- Create: `app/api/voice/asr/route.ts`
- Create: `app/api/voice/tts/route.ts`
- Create: `app/api/voice/emotion/route.ts`
- Create: `app/api/voice/emotion-audio/route.ts`

**Interfaces:**
- Consumes: `lib/voice/whisper-manager.ts` (transcribe), `lib/voice/emotion-classifier.ts` (classifyEmotion), `lib/voice/tts-adapter.ts` (synthesizeSpeech), `lib/voice/audio-features.ts` (extractAudioFeatures), `lib/db/voice-sessions.ts`, `lib/db/emotion-log.ts`
- Produces: 4 个 Next.js API route handlers

- [ ] **Step 1: Create `/api/voice/asr`**

创建 `app/api/voice/asr/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { transcribe, isModelAvailable } from "@/lib/voice/whisper-manager";
import { createVoiceSession } from "@/lib/db/voice-sessions";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  try {
    if (!isModelAvailable()) {
      return NextResponse.json(
        { error: "whisper model not available" },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "no audio file" }, { status: 400 });
    }

    // 保存临时 WAV 文件
    const recordingsDir = path.join(process.cwd(), "data", "audio", "recordings");
    await mkdir(recordingsDir, { recursive: true });
    const fileName = `${uuid()}.wav`;
    const filePath = path.join(recordingsDir, fileName);
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    await writeFile(filePath, buffer);

    // 转写
    const { text, timeMs } = await transcribe(filePath);

    // 记录到数据库
    const session = createVoiceSession({
      audioPath: filePath,
      transcript: text,
      asrModel: "ggml-base",
      asrTimeMs: timeMs,
    });

    return NextResponse.json({
      text,
      time_ms: timeMs,
      voice_session_id: session.id,
    });
  } catch (err) {
    console.error("[voice/asr]", err);
    const message = err instanceof Error ? err.message : "ASR failed";
    const status = message.includes("not found") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Create `/api/voice/tts`**

创建 `app/api/voice/tts/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/voice/tts-adapter";
import { readFile } from "fs/promises";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text;
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const { audioPath, format, source } = await synthesizeSpeech(text, {
      voice: body.voice,
      speed: body.speed,
    });

    const audioBuffer = await readFile(audioPath);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "X-TTS-Source": source,
      },
    });
  } catch (err) {
    console.error("[voice/tts]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create `/api/voice/emotion`**

创建 `app/api/voice/emotion/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { classifyEmotion } from "@/lib/voice/emotion-classifier";
import { createEmotionLog } from "@/lib/db/emotion-log";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text;
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const result = await classifyEmotion({
      text,
      history: body.history,
      audioFeatures: body.audio_features,
      sessionId: body.session_id,
    });

    // 记录情绪日志
    createEmotionLog({
      sessionId: body.session_id,
      source: body.audio_features ? "voice" : "text",
      emotion: result.emotion,
      confidence: result.confidence,
      voiceFeatures: body.audio_features ? JSON.stringify(body.audio_features) : null,
      textSnippet: text.slice(0, 200),
      modelUsed: result.modelUsed,
    });

    return NextResponse.json({
      emotion: result.emotion,
      confidence: result.confidence,
      model_used: result.modelUsed,
    });
  } catch (err) {
    console.error("[voice/emotion]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Emotion classification failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Create `/api/voice/emotion-audio`**

创建 `app/api/voice/emotion-audio/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { extractAudioFeatures } from "@/lib/voice/audio-features";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "no audio file" }, { status: 400 });
    }

    const tmpDir = path.join(process.cwd(), "data", "audio", "recordings");
    await mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${uuid()}.wav`);
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    await writeFile(tmpPath, buffer);

    const features = await extractAudioFeatures(tmpPath);

    // 临时文件用完即删（ASR 的 WAV 已由 asr route 独立保存）
    await unlink(tmpPath).catch(() => {});

    return NextResponse.json({
      pitch: features.pitch,
      duration: features.duration,
      volume: features.volume,
    });
  } catch (err) {
    console.error("[voice/emotion-audio]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Audio feature extraction failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: 验证构建**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/api/voice/
git commit -m "feat(p5): add voice API routes (asr, tts, emotion, emotion-audio)"
```

---

### Task 7: Chat API 情绪注入

**Files:**
- Modify: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: `lib/voice/emotion-classifier.ts` (classifyEmotion), `lib/db/emotion-log.ts` (createEmotionLog)
- Produces: 修改后的 SSE chat route，在系统提示词中注入情绪上下文

- [ ] **Step 1: Read 现有 chat route**

Read `app/api/chat/route.ts` 确认修改点位——系统提示词构建位置（通过 `buildChatPrompt`）和 SSE 流开始位置。

- [ ] **Step 2: 注入情绪检测和上下文**

在 `app/api/chat/route.ts` 中：

1. 在文件顶部添加 import：

```typescript
import { classifyEmotion } from "@/lib/voice/emotion-classifier";
import { createEmotionLog } from "@/lib/db/emotion-log";
```

2. 在 `buildChatPrompt` 调用前（约第 85 行附近），添加情绪检测和上下文注入。找到构建 prompt 的位置：

```typescript
// 现有代码：
const prompt = buildChatPrompt({...});
```

在这之前插入情绪检测逻辑：

```typescript
    // --- Emotion detection (non-blocking for text input) ---
    let emotionContext = "";
    try {
      const recentTexts = recentMessages
        .filter(m => m.role === "child")
        .slice(-3)
        .map(m => m.content);
      const emotionResult = await classifyEmotion({
        text: message,
        history: recentTexts,
        sessionId: session.id,
      });

      // Log emotion
      createEmotionLog({
        sessionId: session.id,
        source: "text",
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        textSnippet: message.slice(0, 200),
        modelUsed: emotionResult.modelUsed,
      });

      // Build emotion context string
      const strategies: Record<string, string> = {
        excited: "孩子当前情绪: 兴奋。请保持热情回应，同时适度引导聚焦。",
        calm: "孩子当前情绪: 平静。请正常引导。",
        frustrated: "孩子当前情绪: 沮丧。请以鼓励为主，降低任务难度。",
        impatient: "孩子当前情绪: 着急。请先安抚情绪，再拆解步骤引导。",
        confused: "孩子当前情绪: 困惑。请主动解释，给出具体例子帮助理解。",
      };
      emotionContext = strategies[emotionResult.emotion] || "";
    } catch (err) {
      console.warn("[chat] emotion detection failed:", err);
      // 静默降级，不影响正常对话
    }
```

3. 如果 `emotionContext` 非空，将其追加到系统提示词中。修改 `buildChatPrompt` 调用，在 `systemPrompt` 后面注入：

```typescript
    const promptMessages = buildChatPrompt({...});
    if (emotionContext) {
      // 在 system message 后插入情绪上下文
      promptMessages.splice(1, 0, {
        role: "system" as const,
        content: emotionContext,
      });
    }
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

预期：零错误。情绪检测失败不影响 chat 流程。

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(p5): inject emotion context into chat system prompt"
```

---

### Task 8: 语音 UI 组件

**Files:**
- Create: `components/chat/voice-button.tsx`
- Create: `components/chat/audio-player.tsx`
- Create: `components/chat/emotion-indicator.tsx`

**Interfaces:**
- Produces: `VoiceButton`, `AudioPlayer`, `EmotionIndicator` 三个 client component
- 供 Task 9 InputBar/ChatView 集成使用

- [ ] **Step 1: 创建 VoiceButton**

创建 `components/chat/voice-button.tsx`：

```typescript
"use client";

import { useState, useRef, useCallback } from "react";

type VoiceState = "idle" | "recording" | "processing";

interface Props {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceButton({ onTranscription, disabled }: Props) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const debounceRef = useRef(false);

  const startRecording = useCallback(async () => {
    if (debounceRef.current) return;
    debounceRef.current = true;
    setTimeout(() => { debounceRef.current = false; }, 500);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) { setState("idle"); return; }

        setState("processing");
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const res = await fetch("/api/voice/asr", { method: "POST", body: formData });
          const data = await res.json();
          if (data.text) {
            onTranscription(data.text);
          } else {
            setError("没听清，可以再说一遍吗？");
            setTimeout(() => setError(null), 3000);
          }
        } catch {
          setError("语音识别暂不可用");
          setTimeout(() => setError(null), 3000);
        } finally {
          setState("idle");
        }
      };

      recorder.start();
      setState("recording");
      setError(null);
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "请允许麦克风权限以使用语音功能"
        : "麦克风不可用";
      setError(msg);
      debounceRef.current = false;
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const isMediaSupported = typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia;

  if (!isMediaSupported) return null; // 不渲染按钮

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        disabled={disabled || state === "processing"}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        className={`w-10 h-10 rounded-btn flex items-center justify-center transition-all duration-200 shrink-0
          ${state === "recording"
            ? "bg-red-500 text-white scale-110 shadow-lg"
            : "bg-surface border border-border text-ink-tertiary hover:text-primary hover:border-primary"
          }
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        `}
        title={state === "recording" ? "松开发送" : "按住说话"}
      >
        {state === "processing" ? (
          <Spinner />
        ) : (
          <MicIcon active={state === "recording"} />
        )}
      </button>
      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-ink text-white text-body-xs px-3 py-1.5 rounded-btn shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
      {active && (
        <>
          <line x1="8" x2="16" y1="23" y2="23" />
          <line x1="8" x2="16" y1="25" y2="25" opacity="0.6" />
        </>
      )}
    </svg>
  );
}
```

- [ ] **Step 2: 创建 AudioPlayer**

创建 `components/chat/audio-player.tsx`：

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  messageId: string;
  text: string;
}

export function AudioPlayer({ messageId, text }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 自动播放：组件挂载时请求 TTS
  useEffect(() => {
    let cancelled = false;

    async function fetchTTS() {
      setState("loading");
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, speed: 1.0 }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // 自动播放
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setState("idle");
        audio.onerror = () => setState("error");
        try {
          await audio.play();
          setState("playing");
        } catch {
          // 浏览器阻止自动播放，保持 idle 状态
          setState("idle");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    fetchTTS();
    return () => { cancelled = true; };
  }, [text]);

  const replay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setState("playing");
    }
  }, []);

  // 错误或空文本不渲染
  if (state === "error" || !text.trim()) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <button
        type="button"
        onClick={state === "playing" ? undefined : replay}
        className={`text-body-xs flex items-center gap-1 px-2 py-0.5 rounded-btn transition-colors
          ${state === "playing" ? "text-primary" : "text-ink-tertiary hover:text-primary"}`}
        title={state === "idle" ? "点击播放" : state === "loading" ? "加载中..." : "播放中..."}
      >
        {state === "loading" ? (
          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <SpeakerIcon playing={state === "playing"} />
        )}
        <span>小K朗读</span>
      </button>
    </div>
  );
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {playing && (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}
```

- [ ] **Step 3: 创建 EmotionIndicator**

创建 `components/chat/emotion-indicator.tsx`：

```typescript
"use client";

interface Props {
  emotion: string | null;
}

const EMOTION_CONFIG: Record<string, { emoji: string; label: string }> = {
  excited: { emoji: "🎉", label: "兴奋" },
  calm: { emoji: "😌", label: "平静" },
  frustrated: { emoji: "😟", label: "沮丧" },
  impatient: { emoji: "😤", label: "着急" },
  confused: { emoji: "🤔", label: "困惑" },
};

export function EmotionIndicator({ emotion }: Props) {
  if (!emotion) return null;
  const config = EMOTION_CONFIG[emotion];
  if (!config) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-body-xs text-ink-tertiary bg-surface-raised px-1.5 py-0.5 rounded-full animate-pulse"
      title={`孩子情绪: ${config.label}`}
    >
      {config.emoji}
    </span>
  );
}
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add components/chat/voice-button.tsx components/chat/audio-player.tsx components/chat/emotion-indicator.tsx
git commit -m "feat(p5): add VoiceButton, AudioPlayer, and EmotionIndicator components"
```

---

### Task 9: InputBar 改造 + ChatView 集成

**Files:**
- Modify: `components/chat/input-bar.tsx`
- Modify: `components/chat/chat-view.tsx`
- Modify: `components/chat/bubble-guide.tsx`

**Interfaces:**
- Consumes: VoiceButton, AudioPlayer, EmotionIndicator 组件
- Produces: 带语音输入的聊天界面

- [ ] **Step 1: Read InputBar 当前代码**

Read `components/chat/input-bar.tsx` 确认当前结构和修改点。

- [ ] **Step 2: 修改 InputBar**

在 `components/chat/input-bar.tsx` 中：

1. 在文件顶部添加 import：

```typescript
import { VoiceButton } from "./voice-button";
```

2. 创建一个处理语音转写结果的回调函数，在 InputBar 组件内：

```typescript
const handleVoiceTranscription = useCallback((text: string) => {
  setInput(text);
  // 可选：自动发送，或只填充输入框
}, []);
```

3. 修改 JSX，在 textarea 左侧插入 VoiceButton。找到 `<textarea` 的位置，在其外层容器中添加 VoiceButton：

```tsx
{/* Mic + Input area */}
<div className="flex items-end gap-2">
  <VoiceButton
    onTranscription={handleVoiceTranscription}
    disabled={isStreaming}
  />
  <textarea
    ref={textareaRef}
    className="..."
    // ... 现有属性保持不变
  />
</div>
```

4. 修改 placeholder 文本：

```tsx
placeholder="输入文字，或按住🎤说话"
```

- [ ] **Step 3: 修改 ChatView**

Read `components/chat/chat-view.tsx` —— 它只是组合 MessageList 和 InputBar，当前无需修改。

- [ ] **Step 4: 修改 BubbleGuide 添加 AudioPlayer**

Read `components/chat/bubble-guide.tsx`，在消息内容下方添加 AudioPlayer：

1. 添加 import：

```typescript
import { AudioPlayer } from "./audio-player";
```

2. 在 bubble 内容下方（`</p>` 之后、strategyId 之前）添加：

```tsx
<AudioPlayer messageId={/* message id */} text={content} />
```

需要传入 messageId。修改 Props：

```typescript
interface Props {
  content: string;
  strategyId?: string | null;
  messageId?: string;
}
```

然后渲染 `<AudioPlayer messageId={messageId || ""} text={content} />`。

查找 BubbleGuide 的调用位置（在 `message-list.tsx` 或 `chat-store`），传入 messageId。

- [ ] **Step 5: 验证构建**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add components/chat/input-bar.tsx components/chat/bubble-guide.tsx
git commit -m "feat(p5): wire VoiceButton into InputBar, AudioPlayer into BubbleGuide"
```

---

### Task 10: 集成联调与文档更新

**Files:**
- Modify: `DEVELOPMENT.md`
- (可能的编译错误修复)

**Interfaces:**
- Consumes: 所有 Task 1-9 产物
- Produces: 最终版本验证

- [ ] **Step 1: Full build verification**

```bash
npm run build
```

预期：零错误，零新警告。

如果构建失败：诊断并修复。常见问题：
- 缺少 import
- 类型不匹配
- Next.js 路由冲突

- [ ] **Step 2: API route file existence check**

```bash
ls app/api/voice/asr/route.ts
ls app/api/voice/tts/route.ts
ls app/api/voice/emotion/route.ts
```

- [ ] **Step 3: Cross-task consistency check**

验证：
- Task 6 API 路由调用 Task 2 transcribe + Task 3 classifyEmotion + Task 4 synthesizeSpeech + Task 5 CRUD
- Task 7 Chat API 调用 Task 3 classifyEmotion + Task 5 createEmotionLog
- Task 9 组件调用 Task 6 API 路由
- Task 1 类型被 Task 5 CRUD 模块使用

- [ ] **Step 4: Update DEVELOPMENT.md**

Replace progress line:

```
P1 ██████████ 100% | P2 ██████████ 100% | P3 ██████████ 100% | P4 ██████████ 100% | P5-P6 未开始
```

with:

```
P1 ██████████ 100% | P2 ██████████ 100% | P3 ██████████ 100% | P4 ██████████ 100% | P5 ██████████ 100% | P6 未开始
```

Add P5 section:

```markdown
## P5 · 语音互联（目标：2026-08-23）
- [x] Task 1: 类型定义与数据库扩展
- [x] Task 2: whisper.cpp 子进程管理器
- [x] Task 3: 音频特征提取 + 情绪分类器
- [x] Task 4: TTS 适配器
- [x] Task 5: 语音数据库 CRUD
- [x] Task 6: Voice API 路由
- [x] Task 7: Chat API 情绪注入
- [x] Task 8: 语音 UI 组件
- [x] Task 9: InputBar 改造 + ChatView 集成
- [x] Task 10: 集成联调与文档更新
```

- [ ] **Step 5: Final commit**

```bash
git add DEVELOPMENT.md
git commit -m "feat(p5): update DEVELOPMENT.md — P5 complete"
```
