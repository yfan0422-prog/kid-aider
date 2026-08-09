import { NextRequest, NextResponse } from "next/server";
import { transcribe, isModelAvailable } from "@/lib/voice/whisper-manager";
import { createVoiceSession } from "@/lib/db/voice-sessions";
import { writeFile, mkdir } from "fs/promises";
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
