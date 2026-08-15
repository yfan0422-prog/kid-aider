# Kid-Aider P10 · 作品存档集（线下作品库）— 设计规格

> 日期：2026-08-15
> 状态：设计确认（待审阅）

## 目标

孩子可将线下实物作品（画画、手工、乐高、科学小实验等）通过拍照或短视频记录，存档到自己的个人作品库中。作品库作为 `/showcase`（作品墙）的一个新标签页，与现有「数字项目」并列展示。上传照片时系统调用视觉大模型自动生成标题、描述与鼓励语，帮助孩子把作品「讲出来」。

---

## 1. 架构总览

```
孩子点击「+ 添加作品」 → 系统相机/相册（accept="image/*,video/*"）
                              ↓
客户端：图片用 Canvas 压缩（最长边 1280px、JPEG 0.85）；视频原样上传
                              ↓
POST /api/works（formData，校验类型/大小）→ 落盘 DATA_DIR/media/works/<child_id>/<uuid>.<ext> → 写库
                              ↓（仅照片）
视觉 LLM（默认对话模型，base64 图片）→ 生成 {title, description, encouragement}
                              ↓
孩子编辑标题/描述 → 确认保存 → 作品墙网格展示
```

零新增 npm 依赖；沿用本地磁盘 + better-sqlite3 + OpenAI 兼容 adapter；不改变现有路由/SSE 架构。

---

## 2. 数据模型

### 2.1 新表 `works`

```sql
CREATE TABLE IF NOT EXISTS works (
  id               TEXT PRIMARY KEY,
  child_id         TEXT NOT NULL DEFAULT '',
  type             TEXT NOT NULL CHECK(type IN ('photo','video')),
  file_path        TEXT NOT NULL,          -- 相对 DATA_DIR 的路径，如 media/works/<child_id>/<uuid>.jpg
  mime_type        TEXT NOT NULL,          -- 如 image/jpeg、video/mp4
  title            TEXT DEFAULT '',        -- 可编辑；照片可被 AI 预填
  description      TEXT DEFAULT '',        -- 可编辑；照片由 AI 生成
  ai_encouragement TEXT DEFAULT '',        -- AI 鼓励语（只读展示）
  size_bytes       INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_works_child ON works(child_id);
```

### 2.2 迁移

`works` 为全新表，在 `lib/db/index.ts` 的 `CREATE TABLE IF NOT EXISTS` 块中新增即可，**无需 ALTER 迁移**，存量数据零风险。

### 2.3 DB 访问层

新增 `lib/db/works.ts`，函数签名：

```typescript
createWork(input: {
  childId: string;
  type: "photo" | "video";
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  title?: string;
  description?: string;
  aiEncouragement?: string;
}): Work;

listWorks(childId: string): Work[];          // 按 created_at DESC
getWork(id: string): Work | null;
updateWorkMeta(id: string, fields: { title?: string; description?: string; aiEncouragement?: string }): Work | null;
deleteWork(id: string): { filePath: string } | null;  // 返回 filePath 供调用方 unlink
```

`Work` 接口导出到 `lib/utils/types.ts`。

---

## 3. 文件存储与路由

### 3.1 存储路径

- 根目录：`process.env.DATA_DIR || path.join(process.cwd(), "data")`（复用 `getDb` 同款逻辑）。
- 作品目录：`<DATA_DIR>/media/works/<child_id>/<uuid>.<ext>`。
- 写入前 `fs.mkdirSync(dir, { recursive: true })`。

### 3.2 `POST /api/works`（上传）

- 从 URL 查询参数取 `child_id`；缺失返回 `400 { error: "child_required" }`（对齐 P9 约定）。
- `formData.get("file")` 取文件；缺失返回 `400 { error: "works.upload.file_missing" }`。
- 校验：
  - 类型：`file.type` 必须以 `image/` 或 `video/` 开头，否则 `400 { error: "works.upload.invalid_type" }`。
  - 大小：`file.size ≤ 50 * 1024 * 1024`，否则 `413 { error: "works.upload.too_large" }`。
- 扩展名从 `file.type` 映射（`image/jpeg→jpg`、`image/png→png`、`image/webp→webp`、`image/heic→heic`、`video/mp4→mp4`、`video/quicktime→mov`、`video/webm→webm`）；无法识别时退回 `file.name` 的扩展名，再退回 `.bin`。
- 落盘：`Buffer.from(await file.arrayBuffer())` → `writeFile`。
- 写库 `createWork`（`title` 用孩子所填、可为空）。
- **照片**：写库后调 `describeWork`（见 §4）生成 `title/description/encouragement`，用 `updateWorkMeta` 回填（`title` 孩子已填则保留、未填才用 AI 值）。
- 返回最终作品对象 `{ id, type, mime_type, title, description, ai_encouragement, created_at }`。

### 3.3 `PATCH /api/works/[id]`（编辑元数据）

- 按 `id` 查 `getWork`，`child_id` 校验，不存在/跨孩子返回 `404`。
- 接收 `{ title?, description? }`，调 `updateWorkMeta` 回写（`ai_encouragement` 只读，不接受覆盖）。
- 返回更新后的作品对象。

### 3.4 `GET /api/works/[id]/file`（取文件）

- 按 `id` 查 `getWork`；不存在返回 `404`。
- 按 `child_id` 校验：查询参数 `child_id` 与作品 `child_id` 不一致返回 `404`（不泄露跨孩子文件）。
- 读文件为 Buffer，`Content-Type` 设为 `mime_type`，`Cache-Control: private, max-age=31536000, immutable`。
- **Range 支持**：解析 `Range` 头，返回 `206` + `Content-Range`，供 `<video>` 拖动；未带 Range 时返回 `200` 全量。

### 3.5 客户端图片压缩

- 组件内用 `FileReader` 读为 `Image`，绘制到 Canvas，等比缩放最长边至 1280px，`canvas.toBlob("image/jpeg", 0.85)`。
- 仅对 `image/*` 且尺寸超限的图片压缩；视频不压缩直接上传。
- 压缩后仍以原扩展名上传（JPEG 输出统一 `image/jpeg`）。

---

## 4. AI 看图

### 4.1 扩展 OpenAI adapter 多模态

修改 `lib/models/openai-adapter.ts`：

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

`streamChat` / `chat` 的 `messages` 直接透传给 SDK（SDK 原生支持 content 数组），现有纯文本调用零改动。

### 4.2 引擎函数 `lib/engine/work-describer.ts`

```typescript
describeWork(opts: {
  imageDataUrl: string;      // base64 data URL（客户端压缩后的照片）
  title?: string;            // 孩子可选填的标题
  ageGroup: AgeGroup;
  lang: string;              // zh-CN / zh-HK / en
}): Promise<{ title: string; description: string; encouragement: string }>;
```

- 用 `routeModel("dialogue")` 取默认对话模型，`adapter.chat({ messages, temperature: 0.6 })` 非流式。
- Prompt（系统 + 用户）：要求模型「你是一位懂孩子的陪伴者，看了这个孩子的线下作品照片，请用孩子的年龄段能听懂的语言，返回严格 JSON，字段：`title`（作品标题，简短）、`description`（2-3 句描述作品）、`encouragement`（一句真诚鼓励）」。用户消息 content 为 `[{type:"text", text:...}, {type:"image_url", image_url:{url: imageDataUrl}}]`。
- 解析：`JSON.parse` 响应文本（剥离可能的 ```json 围栏）；解析失败时回退为「title 用孩子所填、description/encouragement 给默认文案」。
- 语言：`lang === "en"` 时要求英文输出，否则中文。

### 4.3 范围与降级

- **仅照片**调用看图；**视频不调用**（抽帧看图留作后续增强，避免 ffmpeg 转码复杂度）。视频的 `description` 留空或由孩子填写。
- **降级**：`describeWork` 整体 `try/catch`（模型不支持图片 / 超时 / JSON 解析失败），任何异常都返回兜底对象，**绝不阻断上传**。
- 上传路由把 AI 调用放在落盘+写库**之后**，AI 失败不影响作品已存。

---

## 5. UI 改造（扩展 /showcase）

### 5.1 页面结构

`app/showcase/page.tsx` 顶部加 Tab 切换：

| Tab | 内容 |
|---|---|
| 数字项目 | 现有完成项目网格（原样保留，含 feature/unfeature） |
| 线下作品 | 新作品网格 + 「+ 添加作品」按钮 |

Tab 状态用 `useState<"projects" | "works">`。

### 5.2 添加作品流程

1. 「+ 添加作品」按钮触发隐藏的 `<input type="file" accept="image/*,video/*">`（手机系统自动提供拍照/录像/相册三选）。
2. 选中文件后打开上传弹层（`components/showcase/work-upload-dialog.tsx`）：
   - 预览：照片 `<img>`、视频 `<video controls>`。
   - 标题输入框（可选；留空时照片由 AI 补标题）。
   - 「保存」「取消」按钮。
3. 点「保存」→ 前端 `POST /api/works`（multipart：`file` + `title`），弹层进入 loading「上传 + AI 看图生成中…」（视频无 AI，仅上传）。
4. 后端同步处理（见 5.3）返回最终作品 → 前端关闭弹层、刷新网格。
5. 失败提示用 i18n 文案。

### 5.3 上传与 AI 生成的时序

采用「上传时后端同步生成」（仅照片）：

1. 落盘 + 写库（`title` 用孩子所填）。
2. 照片则调 `describeWork` → `updateWorkMeta` 回填（`title` 孩子已填则保留、未填才用 AI 值）。
3. 返回最终作品，前端一次拿到 AI 标题/描述/鼓励语。

视频跳过 AI；AI 失败则降级返回（描述留空），上传不受影响。

### 5.4 作品网格与详情

- 网格卡片（`components/showcase/work-card.tsx`）：照片显示图、视频显示 `<video>` 首帧（`preload="metadata"`）；标题显示在卡片上。
- 点击卡片打开详情弹层（`components/showcase/work-detail-dialog.tsx`）：大图/播放、标题、描述、鼓励语（若有）、创建时间。
- 详情弹层支持「编辑」标题/描述（`PATCH /api/works/[id]`，鼓励语只读）与「删除」（二次确认后 `DELETE /api/works/[id]`，成功后移除卡片）。
- 空状态：新键 `show.works.empty`。

### 5.5 新增/修改文件清单

| 文件 | 动作 |
|---|---|
| `app/api/works/route.ts` | 新增（POST 上传、GET 列表） |
| `app/api/works/[id]/route.ts` | 新增（DELETE 删除、PATCH 编辑） |
| `app/api/works/[id]/file/route.ts` | 新增（GET 流式取文件，Range） |
| `lib/db/works.ts` | 新增 |
| `lib/engine/work-describer.ts` | 新增 |
| `lib/models/openai-adapter.ts` | 修改（多模态 content） |
| `lib/utils/types.ts` | 修改（`Work` 接口） |
| `lib/db/index.ts` | 修改（建 `works` 表） |
| `lib/db/user-account.ts` | 修改（`deleteAccount` 清理 works + 文件） |
| `components/showcase/work-upload-dialog.tsx` | 新增 |
| `components/showcase/work-card.tsx` | 新增 |
| `components/showcase/work-detail-dialog.tsx` | 新增 |
| `app/showcase/page.tsx` | 修改（Tab + 作品网格） |
| `lib/i18n/dict/{zh-CN,zh-HK,en}.ts` | 修改（新文案） |

---

## 6. 隔离与清理

### 6.1 child_id 隔离

- 所有作品操作带 `child_id`（前端 `useChild()` 传入 URL 查询参数），`listWorks(childId)` / `getWork` + `child_id` 校验。
- 取文件路由校验 `child_id`，防止跨孩子读取文件。

### 6.2 删除孩子（`deleteAccount`）

在 `lib/db/user-account.ts` 的 `deleteAccount` 事务中新增：

1. 查该孩子所有 `works` 行，逐个 `unlink(file_path)`（相对 `DATA_DIR` 拼接）。
2. `DELETE FROM works WHERE child_id = ?`。

### 6.3 删除单作品

`DELETE /api/works/[id]`：`deleteWork` 返回 `filePath` → `unlink` → 返回 `200`。

---

## 7. 错误处理

| 场景 | 响应 |
|---|---|
| 无 `child_id` | `400 { error: "child_required" }` |
| 文件缺失 | `400 { error: "works.upload.file_missing" }` |
| 类型非法 | `400 { error: "works.upload.invalid_type" }` |
| 超 50MB | `413 { error: "works.upload.too_large" }` |
| 作品不存在 / 跨孩子 | `404` |
| AI 看图失败 | 降级兜底，不阻断上传 |
| 落盘/写库异常 | `500 { error: ... }`，不写孤儿文件 |

---

## 8. 测试

项目无测试框架，沿用现有门禁：

1. `npx tsc --noEmit`（类型）
2. `npm run lint`
3. `npm run build`
4. curl 端到端（部署后）：
   - 上传照片 → 返回含 AI 生成 title/description/encouragement
   - 上传视频 → 返回（无 AI 描述）
   - `GET /api/works/[id]/file` → 200 + 正确 `Content-Type`，带 Range 返回 206
   - `DELETE /api/works/[id]` → 200，文件被删除
   - 跨 child_id 取文件 → 404

---

## 9. i18n

三语字典新增 `show.works.*` 与相关键（节选）：

| key | zh-CN | en |
|---|---|---|
| `show.tab.projects` | 数字项目 | Projects |
| `show.tab.works` | 线下作品 | Creations |
| `show.works.add` | 添加作品 | Add creation |
| `show.works.empty` | 还没有作品，快拍下你的第一个作品吧 | No creations yet |
| `show.works.ai_generating` | AI 正在看你的作品… | AI is looking at your work… |
| `show.works.title` | 作品标题 | Title |
| `show.works.description` | 描述 | Description |
| `show.works.encouragement` | 鼓励语 | Encouragement |
| `show.works.save` | 保存 | Save |
| `show.works.cancel` | 取消 | Cancel |
| `show.works.delete` | 删除 | Delete |
| `show.works.delete_confirm` | 确定删除这件作品吗？ | Delete this work? |
| `works.upload.file_missing` | 未收到文件 | No file received |
| `works.upload.invalid_type` | 仅支持图片或视频 | Only photos or videos |
| `works.upload.too_large` | 文件过大（≤50MB） | File too large (≤50MB) |

（zh-HK 按繁体补充对应文案；完整 key 在实现计划中给出。）

---

## 10. 全局约束

- 零新增 npm 依赖（图片压缩走客户端 Canvas，无 sharp/jimp）
- TypeScript strict，无 `any`
- 不改变现有路由/SSE 架构
- 不改变 P1-P9 任何功能逻辑
- i18n 覆盖所有新增文案（3 语言）
- 存量数据自动兼容（全新表，无迁移风险）

---

## 11. 不变内容

- 数据库 WAL 模式 + foreign_keys
- 模型路由与适配器（仅扩 content 类型，不改调用签名）
- 分龄配置与 Prompt 模板
- 引导引擎（5 层漏斗）、内容生成引擎、积分/段位/徽章逻辑
- 语音互联情绪分析
- 现有 `/showcase` 数字项目展示逻辑
