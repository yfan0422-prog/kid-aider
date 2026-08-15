# 家长数据面板导出格式改为 HTML 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将家长控制面板「数据面板」的全量数据导出从 JSON 改为自包含 HTML 报告（零新增依赖）。

**Architecture:** 服务端在 `GET /api/parent/export` 内把 13 张表的数据手工拼成一份内联 CSS 的 HTML 字符串返回；前端 `DataPanel` 请求时带上当前 `lang`，下载文件名为 `kid-aider-export.html`。表名/标题经三语字典本地化，单元格值做 HTML 转义。

**Tech Stack:** Next.js 14 App Router + TypeScript strict + better-sqlite3 + 现有 i18n 字典（无新增 npm 依赖）。

## Global Constraints

- 零新增 npm 依赖（服务端手工拼 HTML 字符串）。
- TypeScript strict，无 `any`。
- 不改变现有路由/SSE 架构。
- 不改变 P1-P10 任何功能逻辑（仅替换全量导出的输出格式；单个项目导出 `/api/parent/projects/[id]/export` 保持 JSON 不动）。
- i18n 三语覆盖新增文案。
- 单元格值必须 HTML 转义（`& < > " '`），防止注入。

---

### Task 1: i18n 导出报告标签（三语）

**Files:**
- Modify: `lib/i18n/dict/zh-CN.ts`
- Modify: `lib/i18n/dict/zh-HK.ts`
- Modify: `lib/i18n/dict/en.ts`

**Interfaces:**
- Consumes: 无
- Produces: `parent.export.*` 键（Task 2 路由消费）。

- [ ] **Step 1: 在三个字典里、紧跟现有 `"parent.*"` 段落之后，各追加同一组键**

（三个文件的键名完全一致，仅值不同。插入位置：找到现有任一 `"parent."` 开头的键，在其后的合适位置插入；保持与文件内其余键相同的缩进/引号/尾逗号风格。）

**zh-CN.ts:**

```typescript
  // ─── 数据导出（P4 HTML）────────────────────────────
  "parent.export.report_title": "Kid-Aider 数据导出",
  "parent.export.exported_at": "导出时间",
  "parent.export.date_range": "日期范围",
  "parent.export.all": "全部",
  "parent.export.rows": "行数",
  "parent.export.tbl.sessions": "会话",
  "parent.export.tbl.messages": "消息",
  "parent.export.tbl.projects": "项目",
  "parent.export.tbl.tracks": "项目主线",
  "parent.export.tbl.milestones": "里程碑",
  "parent.export.tbl.tasks": "任务",
  "parent.export.tbl.check_ins": "打卡记录",
  "parent.export.tbl.reflections": "复盘",
  "parent.export.tbl.project_logs": "项目日志",
  "parent.export.tbl.competency_snapshots": "能力快照",
  "parent.export.tbl.badges": "徽章",
  "parent.export.tbl.evidence_events": "证据事件",
  "parent.export.tbl.usage_log": "使用日志",
```

**zh-HK.ts:**

```typescript
  // ─── 數據匯出（P4 HTML）────────────────────────────
  "parent.export.report_title": "Kid-Aider 數據匯出",
  "parent.export.exported_at": "匯出時間",
  "parent.export.date_range": "日期範圍",
  "parent.export.all": "全部",
  "parent.export.rows": "行數",
  "parent.export.tbl.sessions": "會話",
  "parent.export.tbl.messages": "訊息",
  "parent.export.tbl.projects": "項目",
  "parent.export.tbl.tracks": "項目主線",
  "parent.export.tbl.milestones": "里程碑",
  "parent.export.tbl.tasks": "任務",
  "parent.export.tbl.check_ins": "打卡記錄",
  "parent.export.tbl.reflections": "復盤",
  "parent.export.tbl.project_logs": "項目日誌",
  "parent.export.tbl.competency_snapshots": "能力快照",
  "parent.export.tbl.badges": "徽章",
  "parent.export.tbl.evidence_events": "證據事件",
  "parent.export.tbl.usage_log": "使用日誌",
```

**en.ts:**

```typescript
  // ─── Data export (P4 HTML) ────────────────────────────
  "parent.export.report_title": "Kid-Aider Data Export",
  "parent.export.exported_at": "Exported at",
  "parent.export.date_range": "Date range",
  "parent.export.all": "All",
  "parent.export.rows": "rows",
  "parent.export.tbl.sessions": "Sessions",
  "parent.export.tbl.messages": "Messages",
  "parent.export.tbl.projects": "Projects",
  "parent.export.tbl.tracks": "Tracks",
  "parent.export.tbl.milestones": "Milestones",
  "parent.export.tbl.tasks": "Tasks",
  "parent.export.tbl.check_ins": "Check-ins",
  "parent.export.tbl.reflections": "Reflections",
  "parent.export.tbl.project_logs": "Project logs",
  "parent.export.tbl.competency_snapshots": "Competency snapshots",
  "parent.export.tbl.badges": "Badges",
  "parent.export.tbl.evidence_events": "Evidence events",
  "parent.export.tbl.usage_log": "Usage log",
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/dict/zh-CN.ts lib/i18n/dict/zh-HK.ts lib/i18n/dict/en.ts
git commit -m "feat(p4): add parent data export HTML i18n labels (3 locales)"
```

---

### Task 2: 导出路由 JSON → HTML

**Files:**
- Modify: `app/api/parent/export/route.ts`

**Interfaces:**
- Consumes: `getDb()`；`parent.export.*` i18n 键（Task 1）；`lib/i18n/dict/*` 默认导出；`lib/i18n/types` 的 `Locale`/`TranslationDict`。
- Produces: `GET /api/parent/export?from=&to=&lang=` 返回 `text/html` 附件。

- [ ] **Step 1: 重写 `app/api/parent/export/route.ts`**

将整个文件替换为以下完整实现（保留原有 13 表查询与 `from`/`to` 过滤逻辑不变，仅把最终输出从 `NextResponse.json` 改为 HTML 字符串）：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import type { Locale, TranslationDict } from "@/lib/i18n/types";
import zhCN from "@/lib/i18n/dict/zh-CN";
import zhHK from "@/lib/i18n/dict/zh-HK";
import en from "@/lib/i18n/dict/en";

export const dynamic = "force-dynamic";

const DICTS: Record<Locale, TranslationDict> = {
  "zh-CN": zhCN,
  "zh-HK": zhHK,
  en,
};

function tr(lang: string, key: string): string {
  const dict = DICTS[lang as Locale] ?? zhCN;
  return dict[key] ?? zhCN[key] ?? key;
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) ?? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const lang = searchParams.get("lang") || "zh-CN";

  const tables: Record<string, string> = {
    sessions: "sessions",
    messages: "messages",
    projects: "projects",
    tracks: "tracks",
    milestones: "milestones",
    tasks: "tasks",
    check_ins: "check_ins",
    reflections: "reflections",
    project_logs: "project_logs",
    competency_snapshots: "competency_snapshots",
    badges: "badges",
    evidence_events: "evidence_events",
    usage_log: "usage_log",
  };

  const data: Record<string, unknown[]> = {};
  for (const [key, table] of Object.entries(tables)) {
    let query = `SELECT * FROM ${table}`;
    const conditions: string[] = [];
    const params: string[] = [];

    if (from && to && tableHasColumn(table)) {
      const col = tableTimeColumn(table);
      if (col) {
        conditions.push(`${col} >= ? AND ${col} <= ?`);
        params.push(from, to);
      }
    }

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    data[key] = db.prepare(query).all(...params);
  }

  const exportedAt = new Date().toISOString();
  const dateRange = from && to ? `${from} ~ ${to}` : tr(lang, "parent.export.all");

  const sections = Object.entries(tables)
    .map(([key, table]) => {
      const rows = data[key] as Record<string, unknown>[];
      const label = tr(lang, `parent.export.tbl.${key}`);
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      const thead = cols.length
        ? `<tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`
        : "";
      const tbody = rows
        .map((row) => `<tr>${cols.map((c) => `<td>${escapeHtml(row[c])}</td>`).join("")}</tr>`)
        .join("");
      return (
        `<section><h2>${escapeHtml(label)} <span>(${rows.length} ${tr(lang, "parent.export.rows")})</span></h2>` +
        `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table></section>`
      );
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tr(lang, "parent.export.report_title"))}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; margin: 2rem; color: #1a1a1a; line-height: 1.5; }
  header { border-bottom: 2px solid #333; padding-bottom: 1rem; margin-bottom: 2rem; }
  header h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
  header p { margin: 0.25rem 0; color: #555; font-size: 0.9rem; }
  section { margin-bottom: 2.5rem; }
  section h2 { font-size: 1.1rem; margin: 0 0 0.5rem; }
  section h2 span { color: #888; font-weight: normal; font-size: 0.85rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
  th, td { border: 1px solid #ddd; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; word-break: break-word; }
  th { background: #f5f5f5; position: sticky; top: 0; }
  tr:nth-child(even) td { background: #fafafa; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(tr(lang, "parent.export.report_title"))}</h1>
  <p>${escapeHtml(tr(lang, "parent.export.exported_at"))}: ${escapeHtml(exportedAt)}</p>
  <p>${escapeHtml(tr(lang, "parent.export.date_range"))}: ${escapeHtml(dateRange)}</p>
  <p>Version: 1.0</p>
</header>
${sections}
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kid-aider-export.html"',
    },
  });
}

function tableHasColumn(table: string): boolean {
  return ["sessions", "messages", "projects", "tasks", "check_ins", "reflections",
    "project_logs", "competency_snapshots", "badges", "evidence_events", "usage_log"].includes(table);
}

function tableTimeColumn(table: string): string | null {
  const map: Record<string, string> = {
    sessions: "created_at", messages: "created_at", projects: "created_at",
    tasks: "created_at", check_ins: "date", reflections: "created_at",
    project_logs: "created_at", competency_snapshots: "week_start",
    badges: "earned_at", evidence_events: "created_at", usage_log: "date",
  };
  return map[table] || null;
}
```

- [ ] **Step 2: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 无类型错误，构建成功

- [ ] **Step 3: Commit**

```bash
git add app/api/parent/export/route.ts
git commit -m "feat(p4): render full data export as self-contained HTML report"
```

---

### Task 3: 前端 DataPanel 下载 HTML + 门禁

**Files:**
- Modify: `components/parent/data-panel.tsx`

**Interfaces:**
- Consumes: `useLocale()`（`locale`）；`/api/parent/export?lang=`。
- Produces: 下载 `kid-aider-export.html`。

- [ ] **Step 1: 修改 `exportAll()` 与 `useLocale()` 解构**

在 `components/parent/data-panel.tsx` 中：

1. 把 `const { t } = useLocale();` 改为 `const { t, locale } = useLocale();`。
2. 把 `exportAll` 函数体中的 `fetch("/api/parent/export")` 改为 `fetch(\`/api/parent/export?lang=${encodeURIComponent(locale)}\`)`。
3. 把 `a.download = "kid-aider-export.json";` 改为 `a.download = "kid-aider-export.html";`。

改完后 `exportAll` 应为：

```typescript
  const exportAll = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/parent/export?lang=${encodeURIComponent(locale)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kid-aider-export.html";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };
```

- [ ] **Step 2: 全量门禁**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 无类型错误、lint 无 error、构建成功

- [ ] **Step 3: Commit**

```bash
git add components/parent/data-panel.tsx
git commit -m "feat(p4): download data export as HTML with current locale"
```

---

### Task 4: 部署 + 端到端验证（待用户确认后执行）

- [ ] **Step 1: 推送部署**

```bash
git push origin main
ssh root@106.15.180.105 "cd /opt/kid-aider && bash update.sh"
```

- [ ] **Step 2: 服务器端验证**

```bash
curl -s -D - -o /tmp/export.html "http://127.0.0.1:3000/api/parent/export?lang=zh-CN" | head -20
head -c 500 /tmp/export.html
```

Expected:
- 响应头含 `Content-Type: text/html` 与 `Content-Disposition: attachment; filename="kid-aider-export.html"`。
- 响应体以 `<!doctype html>` 开头，含 `<title>Kid-Aider 数据导出</title>`，各表渲染为 `<table>`。
- 不含未转义的 `<script` 注入（若某单元格值含 `<script>` 应显示为 `&lt;script&gt;`）。
