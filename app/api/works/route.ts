import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { createWork, listWorks, updateWorkMeta, worksRootDir, getWork } from "@/lib/db/works";
import { describeWork } from "@/lib/engine/work-describer";
import { getAccount } from "@/lib/db/user-account";
import type { WorkType, AgeGroup } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function extFor(fileName: string, mimeType: string): string {
  if (EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType];
  const dot = fileName.lastIndexOf(".");
  if (dot >= 0) {
    const ext = fileName.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{1,5}$/.test(ext)) return ext;
  }
  return "bin";
}

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });
  return NextResponse.json({ works: listWorks(childId) });
}

export async function POST(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "error.works.file_missing" }, { status: 400 });

  const mimeType = file.type || "application/octet-stream";
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "error.works.invalid_type" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "error.works.too_large" }, { status: 413 });
  }

  const type: WorkType = isImage ? "photo" : "video";
  const title = ((formData.get("title") as string | null) ?? "").trim();
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extFor(file.name, mimeType);
  const fileName = `${uuid()}.${ext}`;
  const relPath = `media/works/${childId}/${fileName}`;
  const absPath = path.join(worksRootDir(), childId, fileName);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);

  const work = createWork({
    childId,
    type,
    filePath: relPath,
    mimeType,
    sizeBytes: file.size,
    title,
  });

  // 照片：AI 看图回填（失败不阻断上传）
  if (type === "photo") {
    try {
      const account = getAccount(childId);
      const ageGroup = (account?.age_group ?? "10-12") as AgeGroup;
      const lang = account?.language ?? "zh-CN";
      const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      const desc = await describeWork({ imageDataUrl: dataUrl, title, ageGroup, lang });
      updateWorkMeta(work.id, {
        title: desc.title || work.title,
        description: desc.description,
        aiEncouragement: desc.encouragement,
      });
    } catch (err) {
      console.error("[works] describe failed:", err);
    }
  }

  return NextResponse.json({ work: getWork(work.id) });
}
