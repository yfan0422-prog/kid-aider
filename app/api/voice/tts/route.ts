import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/voice/tts-adapter";
import { readFile } from "fs/promises";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text;
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "error.text_required" }, { status: 400 });
    }

    const { audioPath, source } = await synthesizeSpeech(text, {
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
