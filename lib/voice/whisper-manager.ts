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
    execSync(`which ${WHISPER_BIN}`, { encoding: "utf8" });
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
