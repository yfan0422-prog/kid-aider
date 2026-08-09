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
