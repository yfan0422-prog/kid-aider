import { NextRequest, NextResponse } from "next/server";
import { extractAudioFeatures } from "@/lib/voice/audio-features";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

// Recording limit is ~20 MB; reject anything larger before reading the body.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "audio file too large" }, { status: 413 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "no audio file" }, { status: 400 });
    }
    if (audioFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "audio file too large" }, { status: 413 });
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
