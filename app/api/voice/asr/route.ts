import { NextRequest, NextResponse } from "next/server";
import { transcribe, isModelAvailable, getModelName } from "@/lib/voice/whisper-manager";
import { convertAudioToWav } from "@/lib/voice/audio-features";
import { createVoiceSession, deleteOldRecordings } from "@/lib/db/voice-sessions";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

// Recording limit is ~20 MB; reject anything larger before reading the body.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    if (!isModelAvailable()) {
      return NextResponse.json(
        { error: "error.asr_unavailable" },
        { status: 503 }
      );
    }

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "error.audio_file_too_large" }, { status: 413 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "error.audio_file_missing" }, { status: 400 });
    }
    if (audioFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "error.audio_file_too_large" }, { status: 413 });
    }

    // 保存上传的原始 blob（webm/opus 或 mp4），再用 ffmpeg 转成 16kHz 单声道 WAV。
    // whisper.cpp 无法直接解码 MediaRecorder 的 webm/opus 或 iOS 的 mp4。
    const recordingsDir = path.join(process.cwd(), "data", "audio", "recordings");
    await mkdir(recordingsDir, { recursive: true });
    const originalExt = path.extname(audioFile.name || "recording.webm") || ".webm";
    const rawPath = path.join(recordingsDir, `${uuid()}${originalExt}`);
    const wavPath = path.join(recordingsDir, `${uuid()}.wav`);
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    await writeFile(rawPath, buffer);
    await convertAudioToWav(rawPath, wavPath);
    // 原始上传文件用完后即删，仅保留转换后的 WAV
    await unlink(rawPath).catch(() => {});

    // 转写
    const { text, timeMs } = await transcribe(wavPath);

    // 记录到数据库
    const session = createVoiceSession({
      audioPath: wavPath,
      transcript: text,
      asrModel: getModelName() ?? "unknown",
      asrTimeMs: timeMs,
    });

    // 定期清理 30 天前的旧录音（spec §3.3）——fire-and-forget，不阻塞转写返回
    setTimeout(() => {
      try {
        deleteOldRecordings(30);
      } catch (err) {
        console.error("[voice/asr] failed to clean old recordings:", err);
      }
    }, 0);

    return NextResponse.json({
      text,
      time_ms: timeMs,
      voice_session_id: session.id,
    });
  } catch (err) {
    console.error("[voice/asr]", err);
    const message = err instanceof Error ? err.message : "ASR failed";
    // "not found"（模型缺失）与 ENOENT（whisper.cpp 二进制缺失）都是 503；
    // 其余错误按 500 处理。
    const status = message.includes("not found") || message.includes("ENOENT") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
