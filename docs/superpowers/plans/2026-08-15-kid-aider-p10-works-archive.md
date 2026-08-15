# P10 作品存档集（线下作品库）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让孩子在 `/showcase` 作品墙新增的「线下作品」标签页里，用照片或短视频把线下实物作品（画画/手工/乐高等）存档到个人作品库，照片上传时由视觉大模型自动生成标题/描述/鼓励语。

**Architecture:** 新增 `works` 表 + `lib/db/works.ts` 数据层 + `lib/engine/work-describer.ts` 看图引擎；三个 API 路由（上传/列表、编辑/删除、流式取文件）；扩展 OpenAI adapter 支持多模态 content；扩展 `/showcase` 页面加 Tab 与三个新组件。媒体落盘 `DATA_DIR/media/works/<child_id>/`，DB 只存相对路径。

**Tech Stack:** Next.js 14 App Router + TypeScript strict + Tailwind CSS v3 + better-sqlite3@11.7.0 + openai SDK v7（多模态）。

## Global Constraints

- 零新增 npm 依赖（图片压缩走客户端 Canvas，无 sharp/jimp）
- TypeScript strict，无 `any`
- 不改变现有路由/SSE 架构，不改变 P1-P9 任何功能逻辑
- 存量数据自动兼容（`works` 为全新表，无 ALTER 迁移）
- i18n 覆盖所有新增文案（zh-CN / zh-HK / en 三语）
- 媒体文件落盘 `DATA_DIR`（`process.env.DATA_DIR || process.cwd()/data`），保证被 `backup.sh` 备份、被 `update.sh` 保留
- **无测试框架**（项目仅 dev/build/lint 脚本，且零新增依赖）：每任务的「测试」用 `npx tsc --noEmit`（类型门禁）+ 最后 `npm run lint` + `npm run build` + curl 端到端

---

### Task 1: 数据层 — `works` 表 + `Work` 类型 + `lib/db/works.ts`

**Files:**
- Modify: `lib/utils/types.ts`（追加类型）
- Modify: `lib/db/index.ts`（`getDataDir()` 导出 + `works` 建表）
- Create: `lib/db/works.ts`

**Interfaces:**
- Produces: `Work` / `WorkType`（types.ts）；`createWork` / `listWorks` / `getWork` / `updateWorkMeta` / `deleteWork` / `deleteWorksByChild` / `worksRootDir` / `resolveWorksPath`（works.ts）；`getDataDir`（index.ts）。后续 Task 2/3/4/6 均依赖这些。

- [ ] **Step 1: 在 `lib/utils/types.ts` 末尾追加类型**

在文件末尾（`BadgeUnlock` 之后）追加：

```typescript
// ─── P10 作品存档 ───────────────────────────────────────────────

export type WorkType = "photo" | "video";

export interface Work {
  id: string;
  child_id: string;
  type: WorkType;
  file_path: string;   // 相对 DATA_DIR 的路径，如 media/works/<child_id>/<uuid>.jpg
  mime_type: string;
  title: string;
  description: string;
  ai_encouragement: string;
  size_bytes: number;
  created_at: string;
}
```

- [ ] **Step 2: 修改 `lib/db/index.ts` —— 提取并导出 `getDataDir`**

在 `let db: Database.Database | null = null;` 之后、`getDb` 之前插入：

```typescript
export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}
```

将 `getDb` 内原有的两行：

```typescript
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const dbPath = path.join(dataDir, "db", "kid-aider.db");
```

改为：

```typescript
  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "db", "kid-aider.db");
```

- [ ] **Step 3: 在 `lib/db/index.ts` 建表**

在 `CREATE INDEX IF NOT EXISTS idx_emotion_log_session ON emotion_log(session_id);`（约第 240 行）之后插入：

```sql
    CREATE TABLE IF NOT EXISTS works (
      id               TEXT PRIMARY KEY,
      child_id         TEXT NOT NULL DEFAULT '',
      type             TEXT NOT NULL CHECK(type IN ('photo','video')),
      file_path        TEXT NOT NULL,
      mime_type        TEXT NOT NULL,
      title            TEXT DEFAULT '',
      description      TEXT DEFAULT '',
      ai_encouragement TEXT DEFAULT '',
      size_bytes       INTEGER DEFAULT 0,
      created_at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_works_child ON works(child_id);
```

（插在 `db.exec(...)` 模板字符串内，紧贴其他建表语句。）

- [ ] **Step 4: 创建 `lib/db/works.ts`**

```typescript
import path from "path";
import { v4 as uuid } from "uuid";
import { getDb, getDataDir } from "./index";
import type { Work, WorkType } from "@/lib/utils/types";

/** 作品媒体根目录（<DATA_DIR>/media/works） */
export function worksRootDir(): string {
  return path.join(getDataDir(), "media", "works");
}

/** 将相对 DATA_DIR 的路径解析为绝对路径 */
export function resolveWorksPath(relPath: string): string {
  return path.join(getDataDir(), relPath);
}

export function createWork(input: {
  childId: string;
  type: WorkType;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  title?: string;
}): Work {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO works (id, child_id, type, file_path, mime_type, title, description, ai_encouragement, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?)
  `).run(id, input.childId, input.type, input.filePath, input.mimeType, input.title ?? "", input.sizeBytes, now);
  return getWork(id)!;
}

export function listWorks(childId: string): Work[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM works WHERE child_id = ? ORDER BY created_at DESC"
  ).all(childId) as Work[];
}

export function getWork(id: string): Work | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM works WHERE id = ?").get(id) as Work) ?? null;
}

export function updateWorkMeta(
  id: string,
  fields: { title?: string; description?: string; aiEncouragement?: string }
): Work | null {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.title !== undefined) { sets.push("title = ?"); values.push(fields.title); }
  if (fields.description !== undefined) { sets.push("description = ?"); values.push(fields.description); }
  if (fields.aiEncouragement !== undefined) { sets.push("ai_encouragement = ?"); values.push(fields.aiEncouragement); }
  if (sets.length === 0) return getWork(id);
  values.push(id);
  db.prepare(`UPDATE works SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getWork(id);
}

/** 删除单作品，返回其相对路径供调用方删除文件；不存在返回 null */
export function deleteWork(id: string): { filePath: string } | null {
  const db = getDb();
  const row = db.prepare("SELECT file_path FROM works WHERE id = ?").get(id) as { file_path: string } | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM works WHERE id = ?").run(id);
  return { filePath: row.file_path };
}

/** 删除某孩子全部作品行，返回被删文件的相对路径数组 */
export function deleteWorksByChild(childId: string): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT file_path FROM works WHERE child_id = ?").all(childId) as { file_path: string }[];
  db.prepare("DELETE FROM works WHERE child_id = ?").run(childId);
  return rows.map((r) => r.file_path);
}
```

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 6: Commit**

```bash
git add lib/utils/types.ts lib/db/index.ts lib/db/works.ts
git commit -m "feat(p10): add works table and db access layer"
```

---

### Task 2: AI 看图 — 扩展 OpenAI adapter 多模态 + `lib/engine/work-describer.ts`

**Files:**
- Modify: `lib/models/openai-adapter.ts`（`ChatContent` 类型）
- Create: `lib/engine/work-describer.ts`

**Interfaces:**
- Consumes: `routeModel`（`lib/models/router.ts`，已存在）；`AgeGroup`（types.ts，已存在）
- Produces: `describeWork(opts) → Promise<WorkDescription>`；`WorkDescription` 类型。Task 3 的上传路由依赖此函数。

- [ ] **Step 1: 修改 `lib/models/openai-adapter.ts` 支持多模态 content**

将第 5-8 行的 `ChatMessage` 定义替换为：

```typescript
export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}
```

`streamChat` / `chat` 内部的 `messages` 透传与 `as OpenAI.Chat.Completions.ChatCompletionMessageParam[]` 断言保持不变（SDK v7 原生支持 content 数组），现有纯文本调用零改动。

- [ ] **Step 2: 创建 `lib/engine/work-describer.ts`**

```typescript
import { routeModel } from "@/lib/models/router";
import type { AgeGroup } from "@/lib/utils/types";

export interface WorkDescription {
  title: string;
  description: string;
  encouragement: string;
}

function stripCodeFence(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "");
  s = s.replace(/\s*```$/, "");
  return s;
}

export async function describeWork(opts: {
  imageDataUrl: string;
  title?: string;
  ageGroup: AgeGroup;
  lang: string;
}): Promise<WorkDescription> {
  const routed = routeModel("dialogue");
  if (!routed) return { title: opts.title ?? "", description: "", encouragement: "" };

  const isEnglish = opts.lang === "en";
  const system = isEnglish
    ? 'You are a warm companion for a child. Look at this child\'s offline creation photo. Respond ONLY with a strict JSON object with keys: "title" (short title), "description" (2-3 sentences), "encouragement" (one sincere sentence).'
    : '你是一位懂孩子的温暖陪伴者。请看这个孩子的线下作品照片，只返回一个严格的 JSON 对象，字段为："title"（简短标题）、"description"（2-3 句描述作品）、"encouragement"（一句真诚鼓励）。';
  const user = isEnglish
    ? "Describe this child's work."
    : `孩子的年龄段：${opts.ageGroup}。请描述这件作品。`;

  try {
    const raw = await routed.adapter.chat({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: opts.imageDataUrl } },
          ],
        },
      ],
      temperature: 0.6,
    });

    const parsed = JSON.parse(stripCodeFence(raw)) as Partial<WorkDescription>;
    const title = typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : (opts.title ?? "");
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const encouragement = typeof parsed.encouragement === "string" ? parsed.encouragement.trim() : "";
    return { title, description, encouragement };
  } catch {
    return { title: opts.title ?? "", description: "", encouragement: "" };
  }
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 4: Commit**

```bash
git add lib/models/openai-adapter.ts lib/engine/work-describer.ts
git commit -m "feat(p10): add multimodal adapter support and work-describer engine"
```

---

### Task 3: API 路由 — 上传/列表、编辑/删除、流式取文件

**Files:**
- Create: `app/api/works/route.ts`（POST 上传 + GET 列表）
- Create: `app/api/works/[id]/route.ts`（PATCH 编辑 + DELETE 删除）
- Create: `app/api/works/[id]/file/route.ts`（GET 流式取文件，支持 Range）

**Interfaces:**
- Consumes: `createWork` / `listWorks` / `getWork` / `updateWorkMeta` / `deleteWork` / `worksRootDir` / `resolveWorksPath`（works.ts）；`describeWork`（work-describer.ts）；`getAccount`（`lib/db/user-account.ts`）
- Produces: REST API 契约，Task 6 UI 依赖。

- [ ] **Step 1: 创建 `app/api/works/route.ts`**

```typescript
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
```

- [ ] **Step 2: 创建 `app/api/works/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { getWork, deleteWork, updateWorkMeta, resolveWorksPath } from "@/lib/db/works";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const work = getWork(params.id);
  if (!work || work.child_id !== childId) {
    return NextResponse.json({ error: "error.works.not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { title?: string; description?: string };
  const updated = updateWorkMeta(params.id, {
    title: typeof body.title === "string" ? body.title.trim() : undefined,
    description: typeof body.description === "string" ? body.description.trim() : undefined,
  });
  return NextResponse.json({ work: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

  const work = getWork(params.id);
  if (!work || work.child_id !== childId) {
    return NextResponse.json({ error: "error.works.not_found" }, { status: 404 });
  }

  const deleted = deleteWork(params.id);
  if (deleted) {
    await unlink(resolveWorksPath(deleted.filePath)).catch(() => {});
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 创建 `app/api/works/[id]/file/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getWork, resolveWorksPath } from "@/lib/db/works";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const childId = req.nextUrl.searchParams.get("child_id");
  if (!childId) return NextResponse.json({ error: "child_required" }, { status: 400 });

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
  if (m) {
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end = m[2] ? parseInt(m[2], 10) : total - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;
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
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 5: Commit**

```bash
git add app/api/works/route.ts "app/api/works/[id]/route.ts" "app/api/works/[id]/file/route.ts"
git commit -m "feat(p10): add works upload/list/edit/delete/file API routes"
```

---

### Task 4: 删除孩子时清理作品

**Files:**
- Modify: `lib/db/user-account.ts`（`deleteAccount`）

**Interfaces:**
- Consumes: `deleteWorksByChild` / `resolveWorksPath`（works.ts）
- Produces: 无（`deleteAccount` 签名不变）

- [ ] **Step 1: 在 `lib/db/user-account.ts` 顶部追加导入**

在现有 `import { getDb } from "./index";` 之后加：

```typescript
import fs from "fs";
import { deleteWorksByChild, resolveWorksPath } from "./works";
```

- [ ] **Step 2: 在 `deleteAccount` 的 `transaction();` 调用之后追加清理**

在 `deleteAccount` 函数体末尾（`transaction();` 那一行之后、函数结束 `}` 之前）插入：

```typescript
  transaction();

  // P10: 删除该孩子的作品行 + 磁盘文件
  const workPaths = deleteWorksByChild(id);
  for (const p of workPaths) {
    try { fs.unlinkSync(resolveWorksPath(p)); } catch { /* 文件可能已不存在 */ }
  }
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 4: Commit**

```bash
git add lib/db/user-account.ts
git commit -m "feat(p10): clean up works files when deleting a child account"
```

---

### Task 5: i18n — 三语新增文案

**Files:**
- Modify: `lib/i18n/dict/zh-CN.ts`
- Modify: `lib/i18n/dict/zh-HK.ts`
- Modify: `lib/i18n/dict/en.ts`

**Interfaces:**
- Consumes: 无
- Produces: 文案键（Task 6 UI 消费）。键前缀沿用现有 `showcase.*` 与 `error.*` 约定。

- [ ] **Step 1: 在三个字典的 `showcase.*` 段落后各追加同一组键**

在每个字典文件里，紧跟现有 `"showcase.view": ...` 之后插入对应语言块（三个文件的键名完全一致，仅值不同）：

**zh-CN.ts:**

```typescript
  // ─── 作品存档（P10）────────────────────────────
  "showcase.tab.projects": "数字项目",
  "showcase.tab.works": "线下作品",
  "showcase.works.add": "＋ 添加作品",
  "showcase.works.empty": "还没有作品，拍下你的第一个作品吧！",
  "showcase.works.empty.tip": "用照片或短视频记录画画、手工等线下作品。",
  "showcase.works.ai_generating": "AI 正在看你的作品…",
  "showcase.works.uploading": "上传中…",
  "showcase.works.saving": "保存中…",
  "showcase.works.title": "作品标题（可选）",
  "showcase.works.description": "描述",
  "showcase.works.encouragement": "给你的鼓励",
  "showcase.works.type.photo": "照片",
  "showcase.works.type.video": "视频",
  "showcase.works.save": "保存",
  "showcase.works.cancel": "取消",
  "showcase.works.edit": "编辑",
  "showcase.works.delete": "删除",
  "showcase.works.delete_confirm": "确定删除这件作品吗？",
  "showcase.works.view": "查看详情",
  "error.works.file_missing": "未收到文件",
  "error.works.invalid_type": "仅支持图片或视频",
  "error.works.too_large": "文件过大（≤50MB）",
  "error.works.not_found": "作品不存在",
```

**zh-HK.ts:**

```typescript
  // ─── 作品存檔（P10）────────────────────────────
  "showcase.tab.projects": "數碼項目",
  "showcase.tab.works": "線下作品",
  "showcase.works.add": "＋ 添加作品",
  "showcase.works.empty": "還沒有作品，拍下你的第一個作品吧！",
  "showcase.works.empty.tip": "用相片或短片記錄畫畫、手工等線下作品。",
  "showcase.works.ai_generating": "AI 正在看你的作品…",
  "showcase.works.uploading": "上載中…",
  "showcase.works.saving": "保存中…",
  "showcase.works.title": "作品標題（可選）",
  "showcase.works.description": "描述",
  "showcase.works.encouragement": "給你的鼓勵",
  "showcase.works.type.photo": "相片",
  "showcase.works.type.video": "影片",
  "showcase.works.save": "保存",
  "showcase.works.cancel": "取消",
  "showcase.works.edit": "編輯",
  "showcase.works.delete": "刪除",
  "showcase.works.delete_confirm": "確定刪除這件作品嗎？",
  "showcase.works.view": "查看詳情",
  "error.works.file_missing": "未收到檔案",
  "error.works.invalid_type": "僅支援圖片或影片",
  "error.works.too_large": "檔案過大（≤50MB）",
  "error.works.not_found": "作品不存在",
```

**en.ts:**

```typescript
  // ─── Works archive (P10) ────────────────────────────
  "showcase.tab.projects": "Projects",
  "showcase.tab.works": "Creations",
  "showcase.works.add": "+ Add creation",
  "showcase.works.empty": "No creations yet — snap your first one!",
  "showcase.works.empty.tip": "Capture drawings, crafts, and other offline works as a photo or short video.",
  "showcase.works.ai_generating": "AI is looking at your work…",
  "showcase.works.uploading": "Uploading…",
  "showcase.works.saving": "Saving…",
  "showcase.works.title": "Title (optional)",
  "showcase.works.description": "Description",
  "showcase.works.encouragement": "Encouragement",
  "showcase.works.type.photo": "Photo",
  "showcase.works.type.video": "Video",
  "showcase.works.save": "Save",
  "showcase.works.cancel": "Cancel",
  "showcase.works.edit": "Edit",
  "showcase.works.delete": "Delete",
  "showcase.works.delete_confirm": "Delete this work?",
  "showcase.works.view": "View",
  "error.works.file_missing": "No file received",
  "error.works.invalid_type": "Only photos or videos are supported",
  "error.works.too_large": "File too large (≤50MB)",
  "error.works.not_found": "Work not found",
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/dict/zh-CN.ts lib/i18n/dict/zh-HK.ts lib/i18n/dict/en.ts
git commit -m "feat(p10): add works archive i18n strings (3 locales)"
```

---

### Task 6: UI — showcase Tab + 作品网格 + 上传/详情弹层

**Files:**
- Create: `components/showcase/work-upload-dialog.tsx`
- Create: `components/showcase/work-card.tsx`
- Create: `components/showcase/work-detail-dialog.tsx`
- Modify: `app/showcase/page.tsx`（Tab + 作品网格 + 添加入口）

**Interfaces:**
- Consumes: `useChild()`（childId）；`useLocale()`（t）；`Work` 类型；`/api/works` 系列路由；`components/ui/dialog.tsx` 的 `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`/`DialogClose`；`common.close`、`error.network` 键（已存在）。
- Produces: `WorkUploadDialog`、`WorkCard`、`WorkDetailDialog` 组件。

- [ ] **Step 1: 创建 `components/showcase/work-upload-dialog.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n/context";
import type { Work } from "@/lib/utils/types";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function compressImage(file: File): Promise<Blob> {
  const MAX_DIM = 1280;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function WorkUploadDialog({ file, childId, onClose, onCreated }: {
  file: File | null;
  childId: string;
  onClose: () => void;
  onCreated: (work: Work) => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle("");
    setError("");
    setSaving(false);
  }, [file]);

  const isVideo = !!file && file.type.startsWith("video/");
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function handleSave() {
    if (!file || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = file.type.startsWith("image/") ? await compressImage(file) : file;
      const fd = new FormData();
      fd.append("file", payload, file.name);
      if (title.trim()) fd.append("title", title.trim());
      const res = await fetch(`/api/works?child_id=${encodeURIComponent(childId)}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(t((body as { error?: string }).error || "error.works.file_missing"));
        return;
      }
      const data = await res.json();
      onCreated(data.work as Work);
      onClose();
    } catch {
      setError(t("error.network"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("showcase.works.add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {file && previewUrl && (
            isVideo
              ? <video src={previewUrl} controls className="w-full rounded-lg" />
              : <img src={previewUrl} alt="" className="w-full rounded-lg" />
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("showcase.works.title")}
            disabled={saving}
            className="w-full rounded-btn border-2 border-border px-4 py-3 focus:border-primary focus:outline-none"
          />
          {saving && (
            <p className="text-body-sm text-ink-tertiary">
              {isVideo ? t("showcase.works.uploading") : t("showcase.works.ai_generating")}
            </p>
          )}
          {error && <p className="text-body-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="rounded-btn border border-border px-4 py-2 text-ink-tertiary">
              {t("showcase.works.cancel")}
            </button>
          </DialogClose>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-btn bg-primary px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {t("showcase.works.save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 创建 `components/showcase/work-card.tsx`**

```tsx
"use client";

import { useLocale } from "@/lib/i18n/context";
import type { Work } from "@/lib/utils/types";

export function WorkCard({ work, childId, onClick }: {
  work: Work;
  childId: string;
  onClick: () => void;
}) {
  const { t } = useLocale();
  const src = `/api/works/${work.id}/file?child_id=${encodeURIComponent(childId)}`;
  const label = work.title
    || t(work.type === "video" ? "showcase.works.type.video" : "showcase.works.type.photo");

  return (
    <button
      onClick={onClick}
      className="group text-left bg-surface border border-border rounded-card p-2 hover:shadow-sm transition-all"
    >
      {work.type === "video" ? (
        <video src={src} preload="metadata" muted className="w-full aspect-square object-cover rounded-lg" />
      ) : (
        <img src={src} alt={work.title} className="w-full aspect-square object-cover rounded-lg" />
      )}
      <div className="px-2 py-2">
        <p className="text-body-sm font-semibold text-ink truncate">{label}</p>
      </div>
    </button>
  );
}
```

- [ ] **Step 3: 创建 `components/showcase/work-detail-dialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n/context";
import type { Work } from "@/lib/utils/types";

export function WorkDetailDialog({ work, childId, onClose, onUpdated, onDeleted }: {
  work: Work | null;
  childId: string;
  onClose: () => void;
  onUpdated: (work: Work) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (work) {
      setTitle(work.title);
      setDescription(work.description);
      setEditing(false);
    }
  }, [work]);

  async function handleSave() {
    if (!work || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/works/${work.id}?child_id=${encodeURIComponent(childId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      onUpdated(data.work as Work);
      setEditing(false);
    } catch {
      /* 忽略，保持编辑态 */
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!work || deleting) return;
    if (!confirm(t("showcase.works.delete_confirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/works/${work.id}?child_id=${encodeURIComponent(childId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      onDeleted(work.id);
      onClose();
    } catch {
      /* 忽略 */
    } finally {
      setDeleting(false);
    }
  }

  if (!work) return null;
  const src = `/api/works/${work.id}/file?child_id=${encodeURIComponent(childId)}`;
  const label = work.title
    || t(work.type === "video" ? "showcase.works.type.video" : "showcase.works.type.photo");

  return (
    <Dialog open={!!work} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("showcase.works.view")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {work.type === "video"
            ? <video src={src} controls className="w-full rounded-lg" />
            : <img src={src} alt={work.title} className="w-full rounded-lg" />}
          {work.ai_encouragement && (
            <div className="rounded-lg bg-primary/10 p-3 text-primary">💬 {work.ai_encouragement}</div>
          )}
          {editing ? (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("showcase.works.title")}
                className="w-full rounded-btn border-2 border-border px-4 py-3 focus:border-primary focus:outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("showcase.works.description")}
                rows={3}
                className="w-full rounded-btn border-2 border-border px-4 py-3 focus:border-primary focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <h3 className="text-body-lg font-bold text-ink">{label}</h3>
              {work.description && <p className="text-body-sm text-ink-tertiary">{work.description}</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="rounded-btn border border-border px-4 py-2 text-ink-tertiary">
                {t("showcase.works.cancel")}
              </button>
              <button onClick={handleSave} disabled={saving} className="rounded-btn bg-primary px-4 py-2 font-semibold text-white disabled:opacity-40">
                {t("showcase.works.save")}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleDelete} disabled={deleting} className="rounded-btn border border-red-300 px-4 py-2 text-red-500 disabled:opacity-40">
                {t("showcase.works.delete")}
              </button>
              <button onClick={() => setEditing(true)} className="rounded-btn border border-border px-4 py-2 text-ink-tertiary">
                {t("showcase.works.edit")}
              </button>
              <DialogClose asChild>
                <button className="rounded-btn bg-primary px-4 py-2 font-semibold text-white">{t("common.close")}</button>
              </DialogClose>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: 修改 `app/showcase/page.tsx` —— 加 Tab、作品网格与添加入口**

在文件顶部 import 区追加：

```typescript
import { useRef } from "react";
import { useChild } from "@/components/ui/child-provider";
import { WorkUploadDialog } from "@/components/showcase/work-upload-dialog";
import { WorkCard } from "@/components/showcase/work-card";
import { WorkDetailDialog } from "@/components/showcase/work-detail-dialog";
import type { Work } from "@/lib/utils/types";
```

在 `ShowcasePage` 函数体开头（`const { t } = useLocale();` 之后）追加状态与逻辑：

```typescript
  const { childId } = useChild();
  const [tab, setTab] = useState<"projects" | "works">("projects");
  const [works, setWorks] = useState<Work[]>([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [detailWork, setDetailWork] = useState<Work | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== "works" || !childId) return;
    setWorksLoading(true);
    fetch(`/api/works?child_id=${encodeURIComponent(childId)}`)
      .then((r) => r.json())
      .then((d) => setWorks(d.works || []))
      .catch(() => setWorks([]))
      .finally(() => setWorksLoading(false));
  }, [tab, childId]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPendingFile(f);
    e.target.value = "";
  };

  const onCreated = (work: Work) => setWorks((prev) => [work, ...prev]);
  const onUpdated = (work: Work) => setWorks((prev) => prev.map((w) => (w.id === work.id ? work : w)));
  const onDeleted = (id: string) => setWorks((prev) => prev.filter((w) => w.id !== id));
```

将返回的 JSX 中标题区（`<h1>` 行）之后、`loading`/`projects` 块之前，插入 Tab 切换行。具体：在 `<h1 ...>🌟 {t("showcase.title")}</h1>` 之后插入：

```tsx
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setTab("projects")}
            className={`rounded-btn px-4 py-1.5 text-body-sm font-semibold ${tab === "projects" ? "bg-primary text-white" : "border border-border text-ink-tertiary"}`}
          >
            {t("showcase.tab.projects")}
          </button>
          <button
            onClick={() => setTab("works")}
            className={`rounded-btn px-4 py-1.5 text-body-sm font-semibold ${tab === "works" ? "bg-primary text-white" : "border border-border text-ink-tertiary"}`}
          >
            {t("showcase.tab.works")}
          </button>
        </div>
```

将现有「loading 空态 + featured + all projects」的整块 JSX 包进 `{tab === "projects" && ( ... )}` 条件里（保留内部逻辑不动），并在其后新增「线下作品」块：

```tsx
      {tab === "works" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-body-lg font-bold text-ink">{t("showcase.tab.works")}</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!childId}
              className="rounded-btn bg-primary px-4 py-2 text-body-sm font-semibold text-white disabled:opacity-40"
            >
              {t("showcase.works.add")}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={onFileChange}
          />

          {worksLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!worksLoading && works.length === 0 && (
            <div className="text-center py-16">
              <p className="text-ink-tertiary text-body-lg mb-2">{t("showcase.works.empty")}</p>
              <p className="text-ink-tertiary text-body-sm">{t("showcase.works.empty.tip")}</p>
            </div>
          )}

          {!worksLoading && works.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {works.map((w) => (
                <WorkCard key={w.id} work={w} childId={childId ?? ""} onClick={() => setDetailWork(w)} />
              ))}
            </div>
          )}
        </div>
      )}
```

在返回的根 `<div>` 末尾（`</div>` 之前）追加两个弹层：

```tsx
      <WorkUploadDialog
        file={pendingFile}
        childId={childId ?? ""}
        onClose={() => setPendingFile(null)}
        onCreated={onCreated}
      />
      <WorkDetailDialog
        work={detailWork}
        childId={childId ?? ""}
        onClose={() => setDetailWork(null)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
```

（注意：`useEffect`、`useRef` 已在文件顶部导入的 `react` 中——检查现有 import 行，若只导入了 `useEffect, useState` 则补齐 `useRef`。）

- [ ] **Step 5: 类型检查 + 构建**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

Run: `npm run build`
Expected: 构建成功，无 Next.js 报错（注意 showcase 页为 client 组件，`useChild`/`useLocale` 均在 Provider 内）

- [ ] **Step 6: Commit**

```bash
git add components/showcase/work-upload-dialog.tsx components/showcase/work-card.tsx components/showcase/work-detail-dialog.tsx app/showcase/page.tsx
git commit -m "feat(p10): add works tab, grid, upload and detail dialogs to showcase"
```

---

### Task 7: 全量门禁 + 部署 + 端到端验证

**Files:** 无（验证 + 部署）

**Interfaces:**
- Consumes: 前 6 个任务的产物
- Produces: 已部署并验证的功能

- [ ] **Step 1: 全量门禁**

Run: `npx tsc --noEmit && npm run lint`
Expected: 类型无错误、lint 无 error

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 2: 提交其余改动并推送部署**

```bash
git status --short
git add -A
git commit -m "feat(p10): works archive (offline creations gallery)"
git push origin main
ssh root@106.15.180.105 "cd /opt/kid-aider && bash update.sh"
```

- [ ] **Step 3: 端到端验证（服务器上）**

在服务器上执行（`CHILD` 取第一个孩子 id）：

```bash
CHILD=$(node -e 'const db=require("better-sqlite3")("/opt/kid-aider-data/db/kid-aider.db"); const r=db.prepare("SELECT id FROM user_account ORDER BY created_at ASC LIMIT 1").get(); console.log(r?r.id:"");')

# 1. 上传一张照片（用服务端已有小图；此处生成 1x1 PNG）
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/w.png
WORK=$(curl -s -X POST "http://127.0.0.1:3000/api/works?child_id=$CHILD" -F "file=@/tmp/w.png;type=image/png" -F "title=测试")
echo "$WORK"
WID=$(echo "$WORK" | node -e 'process.stdin.on("data",d=>{try{console.log(JSON.parse(d).work.id)}catch{}})')

# 2. 列表
curl -s "http://127.0.0.1:3000/api/works?child_id=$CHILD"

# 3. 取文件（全量 + Range）
curl -s -o /dev/null -w "full:%{http_code} type:%{content_type}\n" "http://127.0.0.1:3000/api/works/$WID/file?child_id=$CHILD"
curl -s -o /dev/null -w "range:%{http_code}\n" -H "Range: bytes=0-0" "http://127.0.0.1:3000/api/works/$WID/file?child_id=$CHILD"

# 4. 编辑
curl -s -X PATCH "http://127.0.0.1:3000/api/works/$WID?child_id=$CHILD" -H 'Content-Type: application/json' -d '{"title":"改过的标题"}'

# 5. 跨孩子取文件（应 404）
curl -s -o /dev/null -w "cross-child:%{http_code}\n" "http://127.0.0.1:3000/api/works/$WID/file?child_id=bad-id"

# 6. 删除
curl -s -X DELETE "http://127.0.0.1:3000/api/works/$WID?child_id=$CHILD"
```

Expected:
- 上传返回含 `work.id`；照片会带 AI 生成的 `title`/`description`/`ai_encouragement`（若当前模型不支持图片则三者可能为空，属预期降级，不报错）
- 列表含该作品
- `full:200`、`type:image/png`、`range:206`
- 编辑返回 `title` 已更新
- `cross-child:404`
- 删除返回 `{"success":true}`，且 `ls /opt/kid-aider-data/media/works/$CHILD/` 无残留文件

- [ ] **Step 4: 确认工作区干净**

Run: `git status --short`
Expected: 无未提交改动
