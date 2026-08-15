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
    .map(([key]) => {
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
