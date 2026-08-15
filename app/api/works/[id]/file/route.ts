import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getWork, resolveWorksPath } from "@/lib/db/works";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(childId)) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const work = getWork(params.id);
  if (!work || work.child_id !== childId) {
    return NextResponse.json({ error: "error.works.not_found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(resolveWorksPath(work.file_path));
  } catch {
    return NextResponse.json({ error: "error.works.not_found" }, { status: 404 });
  }
  const total = buffer.length;

  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && (m[1] !== "" || m[2] !== "")) {
    let start: number;
    let end: number;
    if (m[1] === "") {
      // 后缀范围 bytes=-N：返回最后 N 字节
      const suffixLen = parseInt(m[2], 10);
      if (Number.isNaN(suffixLen) || suffixLen <= 0) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      }
      start = Math.max(total - suffixLen, 0);
      end = total - 1;
    } else {
      start = parseInt(m[1], 10);
      if (Number.isNaN(start)) start = 0;
      end = m[2] !== "" ? parseInt(m[2], 10) : total - 1;
      if (Number.isNaN(end) || end >= total) end = total - 1;
    }
    if (start > end || start >= total) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    const chunk = buffer.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": work.mime_type,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": work.mime_type,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
