# Kid-Aider · 家长数据面板导出格式改为 HTML — 设计规格

> 日期：2026-08-15
> 状态：设计确认

## 目标

将家长控制面板「数据面板」的全量数据导出从 **JSON** 改为 **自包含 HTML 报告**。家长下载后用浏览器直接打开即可阅读，需要 PDF 时用浏览器「打印 → 另存为 PDF」一步完成。零新增 npm 依赖。

## 现状

- 入口：`components/parent/data-panel.tsx` 的「全量导出」按钮 → `exportAll()` → `GET /api/parent/export`。
- 当前后端 `app/api/parent/export/route.ts` 将 13 张表全量 dump 为 JSON（`{ exported_at, version, date_range, tables }`），`Content-Disposition: attachment; filename=kid-aider-export.json`。
- 支持 `?from=&to=` 日期过滤（按各表的时间列）。
- 单个项目导出 `/api/parent/projects/[id]/export`（JSON）**不在本次范围**，保持不动。

## 变更

### 1. `app/api/parent/export/route.ts`

把 `NextResponse.json(...)` 换成返回 HTML 字符串：

- **Content-Type**：`text/html; charset=utf-8`。
- **Content-Disposition**：`attachment; filename=kid-aider-export.html`。
- **保留** `?from=&to=` 过滤逻辑、`exported_at`、`version`、`date_range` 元信息。
- **新增** `lang` 查询参数（`zh-CN` / `zh-HK` / `en`，缺省 `zh-CN`），用于报告表名与标题的本地化。
- **HTML 结构**（自包含，内联 `<style>`，无外部资源）：

```
<!doctype html><html lang="{lang}"><head><meta charset="utf-8">
<title>{title}</title><style>…基础排版…</style></head>
<body>
  <header> 标题 + 导出时间 + 版本 + 日期范围 </header>
  <section> 每张表：表名标题 + 行数 + <table>（表头=原列名，行=数据）</section>
  …
</body></html>
```

- **转义**：所有单元格值经 HTML 转义（`& < > " '`），防止注入。单元格值为 `null` 显示空串，对象/数组 `JSON.stringify` 后转义。
- **列名**：按 DB 原字段名（`snake_case`）原样展示，不做翻译。

### 2. `components/parent/data-panel.tsx`

`exportAll()` 改为：下载文件名 `kid-aider-export.html`（或直接由响应头驱动，无需手写文件名），并在请求 URL 带上当前语言 `lang`（取 `useLocale()`）。

### 3. i18n

三语字典各新增导出报告标签键（表名 + 报告标题）。表名映射见下：

| key | zh-CN | zh-HK | en |
|---|---|---|---|
| `parent.export.report_title` | Kid-Aider 数据导出 | Kid-Aider 數據匯出 | Kid-Aider Data Export |
| `parent.export.exported_at` | 导出时间 | 匯出時間 | Exported at |
| `parent.export.date_range` | 日期范围 | 日期範圍 | Date range |
| `parent.export.all` | 全部 | 全部 | All |
| `parent.export.rows` | 行数 | 行數 | rows |
| `parent.export.tbl.sessions` | 会话 | 會話 | Sessions |
| `parent.export.tbl.messages` | 消息 | 訊息 | Messages |
| `parent.export.tbl.projects` | 项目 | 項目 | Projects |
| `parent.export.tbl.tracks` | 项目主线 | 項目主線 | Tracks |
| `parent.export.tbl.milestones` | 里程碑 | 里程碑 | Milestones |
| `parent.export.tbl.tasks` | 任务 | 任務 | Tasks |
| `parent.export.tbl.check_ins` | 打卡记录 | 打卡記錄 | Check-ins |
| `parent.export.tbl.reflections` | 复盘 | 復盤 | Reflections |
| `parent.export.tbl.project_logs` | 项目日志 | 項目日誌 | Project logs |
| `parent.export.tbl.competency_snapshots` | 能力快照 | 能力快照 | Competency snapshots |
| `parent.export.tbl.badges` | 徽章 | 徽章 | Badges |
| `parent.export.tbl.evidence_events` | 证据事件 | 證據事件 | Evidence events |
| `parent.export.tbl.usage_log` | 使用日志 | 使用日誌 | Usage log |

## 全局约束

- 零新增 npm 依赖（服务端手工拼 HTML 字符串）。
- TypeScript strict，无 `any`。
- 不改变现有路由/SSE 架构。
- 不改变 P1-P10 任何功能逻辑（仅替换全量导出的输出格式）。
- i18n 三语覆盖新增文案。
- 单个项目导出保持 JSON 不变。

## 不变内容

- `/api/parent/export` 的 13 表查询逻辑、日期过滤、`exported_at`/`version` 元信息。
- `DataPanel` 的快照功能（`/api/competency`）完全不动。
- 其余家长面板 Tab（用量/模型/项目/画像/内容/日志）不动。
