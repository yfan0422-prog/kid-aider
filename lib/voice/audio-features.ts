import { spawn } from "child_process";

export interface AudioFeatures {
  pitch: number;    // 平均音高 (Hz), 估算
  duration: number; // 音频时长 (秒), 间接反映语速 (越短越急/越快)
  volume: number;   // 平均音量 (RMS 归一化 0-1)
}

/**
 * 使用 sox / ffprobe 提取音频特征。
 * 工具缺失、解析失败或超时时优雅降级为默认值，绝不抛错。
 */
export async function extractAudioFeatures(audioPath: string): Promise<AudioFeatures> {
  // 使用 sox 提取统计信息
  const stats = await soxStats(audioPath);
  // 使用 ffprobe 估算时长
  const duration = await getAudioDuration(audioPath);

  return {
    pitch: estimatePitch(stats),
    duration,
    volume: clamp(stats.rms / 0.3, 0, 1), // 归一化
  };
}

interface SoxStats {
  rms: number;
  freq: number;
}

function soxStats(audioPath: string): Promise<SoxStats> {
  return new Promise((resolve) => {
    const child = spawn("sox", [audioPath, "-n", "stats"], { timeout: 5000 });
    let out = "";
    child.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { out += d.toString(); });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        // sox 不可用或退出非零：返回默认值
        resolve({ rms: 0.1, freq: 200 });
        return;
      }
      const rmsMatch = out.match(/RMS lev dB\s+([-\d.]+)/);
      const freqMatch = out.match(/Rough frequency\s+(\d+)/);
      resolve({
        rms: rmsMatch ? Math.pow(10, parseFloat(rmsMatch[1]) / 20) : 0.1,
        freq: freqMatch ? parseInt(freqMatch[1], 10) : 200,
      });
    });

    child.on("error", () => resolve({ rms: 0.1, freq: 200 }));
  });
}

async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve) => {
    // 用 ffprobe 获取时长 (秒)
    const child = spawn("ffprobe", [
      "-v", "quiet",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      audioPath,
    ], { timeout: 5000 });
    let out = "";
    child.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { out += d.toString(); });

    child.on("close", (code: number | null) => {
      if (code !== 0) { resolve(3.0); return; }
      const duration = parseFloat(out.trim());
      if (isNaN(duration) || duration <= 0) { resolve(3.0); return; }
      resolve(duration);
    });

    child.on("error", () => resolve(3.0));
  });
}

function estimatePitch(stats: SoxStats): number {
  // 儿童音高范围: 200-500 Hz, 从 sox 的 rough frequency 近似
  return clamp(stats.freq, 100, 600);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
