# P8c 国际化 (i18n) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 UI 层面三语言切换（zh-CN/zh-HK/en），覆盖全部 ~59 个客户端组件 + 10 个页面 + ~30 条 API 路由错误消息，零新增依赖。

**Architecture:** React Context + 字典对象。`LocaleProvider` 在根 layout 包裹，`useLocale()` hook 返回 `t(key)` 翻译函数。语言偏好存 localStorage，SSR 从 Accept-Language 检测。导航栏新增语言切换下拉按钮。

**Tech Stack:** Next.js 14 App Router + TypeScript strict + Tailwind CSS v3（零新增 npm 依赖）

## Global Constraints

- 零新增 npm 依赖
- TypeScript strict，无 `any`
- 不改变路由结构（无 URL 路径前缀）
- 不改变 SSE 架构
- 遵循项目 Tailwind token 设计系统
- P1-P8b 所有现有功能不受影响
- P7 内容语言（TopicLanguage）独立运作，不与 UI 语言耦合
- 所有文本 key 必须在 zh-CN 字典中有定义（zh-CN 是权威源）
- 所有新路由 `export const dynamic = "force-dynamic"`（本计划不创建新路由）
- DB 访问通过 `import { getDb } from "./index"`（本计划不涉及 DB）

---

## File Map

| 文件 | 操作 | 职责 |
|---|---|---|
| `lib/i18n/types.ts` | Create | Locale 类型、TranslationDict 类型 |
| `lib/i18n/context.tsx` | Create | LocaleProvider + useLocale() hook |
| `lib/i18n/dict/zh-CN.ts` | Create | 简体中文字典（权威源，所有 key） |
| `lib/i18n/dict/zh-HK.ts` | Create | 繁體中文字典 |
| `lib/i18n/dict/en.ts` | Create | 英文字典 |
| `lib/i18n/index.ts` | Create | barrel re-export |
| `components/ui/locale-switcher.tsx` | Create | 导航栏语言切换下拉按钮 |
| `app/layout.tsx` | Modify | 包裹 LocaleProvider（需 client wrapper） |
| `app/page.tsx` | Modify | 添加 LocaleSwitcher 到导航栏 |
| ~59 个客户端组件 | Modify | 硬编码中文 → `t(key)` 调用 |
| ~10 个页面文件 | Modify | 页面标题/描述 → `t(key)` |
| ~30 个 API 路由 | Modify | `{ error: "中文" }` → `{ error: "error.xxx" }` |

---

### Task 1: i18n 基础设施 + zh-CN 字典 + 导航切换

**Files:**
- Create: `lib/i18n/types.ts`
- Create: `lib/i18n/context.tsx`
- Create: `lib/i18n/dict/zh-CN.ts`
- Create: `lib/i18n/dict/zh-HK.ts`
- Create: `lib/i18n/dict/en.ts`
- Create: `lib/i18n/index.ts`
- Create: `components/ui/locale-switcher.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces:
  - `Locale = "zh-CN" | "zh-HK" | "en"`
  - `TranslationDict = Record<string, string>`
  - `LocaleProvider({ children, initialLocale })` — wraps app
  - `useLocale(): { t, locale, setLocale }` — consumer hook
  - `t(key, params?)` — lookup + template interpolation

- [ ] **Step 1: 创建 types.ts**

```typescript
// lib/i18n/types.ts
export type Locale = "zh-CN" | "zh-HK" | "en";

export type TranslationDict = Record<string, string>;

export const LOCALES: Locale[] = ["zh-CN", "zh-HK", "en"];

export const LOCALE_LABELS: Record<Locale, { flag: string; label: string }> = {
  "zh-CN": { flag: "🇨🇳", label: "简体中文" },
  "zh-HK": { flag: "🇭🇰", label: "繁體中文" },
  en: { flag: "🇬🇧", label: "English" },
};

export function detectLocale(acceptLanguage?: string | null): Locale {
  if (acceptLanguage) {
    for (const locale of LOCALES) {
      if (acceptLanguage.toLowerCase().startsWith(locale.toLowerCase().replace("-HK", ""))) {
        return locale;
      }
    }
  }
  return "zh-CN";
}
```

- [ ] **Step 2: 创建 zh-CN 字典（权威源，包含后续所有任务需要的 key）**

```typescript
// lib/i18n/dict/zh-CN.ts
import type { TranslationDict } from "../types";

const zhCN: TranslationDict = {
  // ─── 导航 nav ────────────────────────────────
  "nav.home": "Kid-Aider",
  "nav.me": "👤 我的",
  "nav.explore": "🔍 探索",
  "nav.projects": "🚀 项目",
  "nav.growth": "🌟 成长",
  "nav.showcase": "🖼 作品",
  "nav.report": "📊 报告",
  "nav.settings": "⚙ 设置",
  "nav.parent": "👨‍👩‍👧 家长",
  "nav.language": "🌐 语言",

  // ─── 聊天 chat ────────────────────────────────
  "chat.input.placeholder": "说说你想做什么吧...",
  "chat.input.send": "发送",
  "chat.input.recording": "正在录音...",
  "chat.input.voice.start": "开始语音",
  "chat.input.voice.stop": "停止录音",
  "chat.empty": "说出你的想法，K 来帮你一步步实现！",
  "chat.streaming": "K 正在思考...",
  "chat.age.label": "年龄",
  "chat.age.6-9": "6-9 岁",
  "chat.age.10-12": "10-12 岁",
  "chat.age.13-15": "13-15 岁",
  "chat.emotion.excited": "兴奋",
  "chat.emotion.calm": "平静",
  "chat.emotion.curious": "好奇",
  "chat.emotion.frustrated": "受挫",
  "chat.emotion.confident": "自信",

  // ─── 漏斗 funnel ──────────────────────────────
  "funnel.collecting": "收集需求中...",
  "funnel.complete": "需求梳理完成",
  "funnel.pack.ready": "方案已生成",
  "funnel.pack.preview": "查看方案",
  "funnel.pack.export": "导出方案",
  "funnel.pack.confirm": "确认方案",

  // ─── 探索 explore ──────────────────────────────
  "explore.title": "探索创造",
  "explore.loading": "加载话题...",
  "explore.empty": "暂无话题",
  "explore.category.sci": "自然科学",
  "explore.category.tech": "技术编程",
  "explore.category.art": "视觉艺术",
  "explore.category.music": "音乐表演",
  "explore.category.history": "历史长廊",
  "explore.category.classics": "国学经典",
  "explore.category.poetry": "诗词歌赋",
  "explore.category.tcm": "中医智慧",
  "explore.category.chinese": "中文精进",
  "explore.category.english": "英文探索",
  "explore.category.math": "数学思维",
  "explore.category.general": "综合能力",
  "explore.tab.create": "探索创造",
  "explore.tab.culture": "文化根基",
  "explore.tab.academic": "学业赋能",
  "explore.language.label": "内容语言",
  "explore.generate": "生成内容",
  "explore.generating": "正在生成内容...",
  "explore.regenerate": "重新生成",
  "explore.content.ready": "内容已就绪",
  "explore.content.loading": "正在准备内容...",
  "explore.content.error": "内容加载失败",
  "explore.challenge.title": "🎯 互动挑战",
  "explore.challenge.complete": "✅ 完成挑战 (+20分)",
  "explore.challenge.difficulty": "难度",
  "explore.challenge.minutes": "分钟",
  "explore.project.cta": "进入项目工坊",
  "explore.project.linked": "查看项目",
  "explore.project.dialog.title": "开始一个新项目",
  "explore.project.dialog.name.label": "项目名称",
  "explore.project.dialog.name.placeholder": "给你的项目起个名字",
  "explore.project.dialog.milestones": "📋 里程碑预览（来自挑战）",
  "explore.project.dialog.milestones.empty": "暂无挑战",
  "explore.project.dialog.btn.map": "📋 查看项目地图",
  "explore.project.dialog.btn.chat": "💬 和 K 一起梳理",
  "explore.project.dialog.error.default": "创建项目失败，请稍后重试",
  "explore.project.dialog.error.network": "网络连接失败，请检查网络后重试",
  "explore.project.dialog.cancel": "取消",
  "explore.back": "← 返回",

  // ─── 项目 project ──────────────────────────────
  "project.list.title": "项目工坊",
  "project.list.empty": "还没有项目，去探索页看看吧！",
  "project.list.create": "新建项目",
  "project.list.active": "进行中",
  "project.list.paused": "已暂停",
  "project.list.completed": "已完成",
  "project.detail.track.default": "默认轨道",
  "project.detail.track.add": "添加轨道",
  "project.detail.milestone.add": "添加里程碑",
  "project.detail.milestone.empty": "暂无里程碑",
  "project.detail.task.add": "添加任务",
  "project.detail.task.empty": "暂无任务",
  "project.detail.task.what": "做什么",
  "project.detail.task.hint": "怎么做",
  "project.detail.task.difficulty": "难度",
  "project.detail.task.done": "完成",
  "project.detail.task.undo": "撤销",
  "project.status.active": "进行中",
  "project.status.paused": "已暂停",
  "project.status.completed": "已完成",
  "project.action.pause": "暂停项目",
  "project.action.resume": "恢复项目",
  "project.action.complete": "完成项目",
  "project.action.delete": "删除项目",
  "project.action.edit": "编辑",
  "project.checkin.title": "今日打卡",
  "project.checkin.summary.label": "今天做了什么？",
  "project.checkin.submit": "✅ 打卡 (+15分)",
  "project.checkin.streak": "连续打卡",
  "project.checkin.day": "天",
  "project.reflection.title": "复盘",
  "project.reflection.q1": "今天的收获是什么？",
  "project.reflection.q2": "遇到了什么困难？",
  "project.reflection.q3": "明天想做什么？",
  "project.reflection.q4": "有什么想对 K 说的？",
  "project.reflection.submit": "💭 提交复盘 (+25分)",
  "project.log.task_done": "完成任务",
  "project.log.check_in": "打卡",
  "project.log.reflection": "复盘",
  "project.log.milestone_complete": "里程碑完成",
  "project.log.track_complete": "轨道完成",

  // ─── 个人 me ──────────────────────────────────
  "me.title": "我的",
  "me.points": "积分",
  "me.streak.current": "当前连击",
  "me.streak.longest": "最长连击",
  "me.badges.title": "徽章",
  "me.badges.empty": "还没有徽章，继续加油！",
  "me.rank.title": "段位",
  "me.rank.bronze": "青铜",
  "me.rank.silver": "白银",
  "me.rank.gold": "黄金",
  "me.rank.diamond": "钻石",
  "me.rank.legendary": "传说",
  "me.activity.today": "今日活动",
  "me.activity.empty": "今天还没有活动记录",
  "me.summary.title": "每日小结",
  "me.summary.empty": "暂无数据",
  "me.avatar.edit": "修改头像",

  // ─── 成长 growth ────────────────────────────────
  "growth.title": "成长轨迹",
  "growth.dimension.clarification": "澄清能力",
  "growth.dimension.decomposition": "拆解能力",
  "growth.dimension.execution": "执行能力",
  "growth.dimension.reflection": "反思能力",
  "growth.dimension.creativity": "创造力",
  "growth.dimension.persistence": "坚持力",
  "growth.radar.title": "能力雷达",
  "growth.trend.title": "成长趋势",
  "growth.week.label": "第 {n} 周",
  "growth.empty": "完成更多任务后，成长数据将在这里展示",

  // ─── 展示 showcase ──────────────────────────────
  "showcase.title": "作品墙",
  "showcase.empty": "还没有作品",
  "showcase.export": "导出",
  "showcase.view": "查看详情",

  // ─── 报告 report ────────────────────────────────
  "report.title": "家长报告",
  "report.competency": "能力分析",
  "report.timeline": "成长时间线",
  "report.highlights": "精彩瞬间",
  "report.empty": "暂无报告数据",

  // ─── 家长 parent ───────────────────────────────
  "parent.title": "家长控制面板",
  "parent.tab.usage": "使用控制",
  "parent.tab.filter": "敏感词过滤",
  "parent.tab.projects": "项目管理",
  "parent.tab.data": "数据面板",
  "parent.tab.logs": "系统日志",
  "parent.usage.daily": "每日使用限制",
  "parent.usage.daily.unit": "分钟/天",
  "parent.usage.quiet": "安静时段",
  "parent.usage.quiet.start": "开始",
  "parent.usage.quiet.end": "结束",
  "parent.usage.filter": "启用敏感词过滤",
  "parent.usage.pause": "暂停所有限制",
  "parent.usage.save": "保存设置",
  "parent.usage.saved": "设置已保存",
  "parent.filter.add": "添加敏感词",
  "parent.filter.placeholder": "输入敏感词",
  "parent.filter.empty": "暂无敏感词",
  "parent.filter.remove": "删除",
  "parent.projects.empty": "暂无项目",
  "parent.projects.detail": "查看详情",
  "parent.projects.export": "导出项目",
  "parent.data.sessions": "总会话数",
  "parent.data.avgDuration": "平均时长",
  "parent.data.engagement": "参与度趋势",
  "parent.data.rising": "上升",
  "parent.data.stable": "稳定",
  "parent.data.declining": "下降",
  "parent.logs.empty": "暂无日志",
  "parent.logs.type": "类型",
  "parent.logs.detail": "详情",
  "parent.logs.time": "时间",
  "parent.child_profile": "儿童画像",

  // ─── 设置 settings ────────────────────────────────
  "settings.title": "设置",
  "settings.model.title": "模型配置",
  "settings.model.add": "添加模型",
  "settings.model.name": "名称",
  "settings.model.provider": "提供商",
  "settings.model.url": "URL",
  "settings.model.key": "API Key",
  "settings.model.model": "模型",
  "settings.model.roles": "角色",
  "settings.model.role.dialogue": "对话",
  "settings.model.role.solution": "方案生成",
  "settings.model.role.quality": "质量评估",
  "settings.model.role.safety": "安全审查",
  "settings.model.params": "参数",
  "settings.model.temperature": "Temperature",
  "settings.model.maxTokens": "Max Tokens",
  "settings.model.default": "默认",
  "settings.model.test": "测试连接",
  "settings.model.testing": "测试中...",
  "settings.model.test.success": "连接成功！延迟 {ms}ms",
  "settings.model.test.fail": "连接失败",
  "settings.model.save": "保存",
  "settings.model.delete": "删除",
  "settings.model.confirmDelete": "确认删除此模型？",
  "settings.language": "语言",

  // ─── 共享组件 common ────────────────────────────────
  "common.save": "保存",
  "common.cancel": "取消",
  "common.confirm": "确认",
  "common.delete": "删除",
  "common.edit": "编辑",
  "common.create": "创建",
  "common.close": "关闭",
  "common.back": "返回",
  "common.loading": "加载中...",
  "common.error": "出错了",
  "common.empty": "暂无数据",
  "common.retry": "重试",
  "common.search": "搜索",
  "common.copy": "复制",
  "common.copied": "已复制",
  "common.export": "导出",
  "common.import": "导入",
  "common.more": "更多",
  "common.actions": "操作",
  "common.yes": "是",
  "common.no": "否",
  "common.ok": "好的",
  "common.success": "操作成功",
  "common.failed": "操作失败",

  // ─── API 错误 error ────────────────────────────────
  "error.generic": "服务器错误，请稍后重试",
  "error.not_found": "未找到",
  "error.unauthorized": "未授权",
  "error.bad_request": "请求无效",
  "error.validation": "输入无效",
  "error.topic_not_found": "话题未找到",
  "error.no_content": "该话题暂无生成内容",
  "error.project_name_required": "项目名称不能为空",
  "error.project_not_found": "项目未找到",
  "error.session_not_found": "会话未找到",
  "error.challenge_not_found": "挑战未找到",
  "error.model_test_failed": "模型连接测试失败",
  "error.create_project_failed": "项目创建失败",
  "error.content_generation_failed": "内容生成失败，请稍后重试",
  "error.content_generation_timeout": "内容生成超时，请稍后重试",
  "error.network": "网络连接失败，请检查网络后重试",
  "error.points_record_failed": "积分记录失败",
};
export default zhCN;
```

- [ ] **Step 3: 创建 context.tsx**

```typescript
// lib/i18n/context.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Locale, TranslationDict } from "./types";
import { detectLocale } from "./types";
import zhCN from "./dict/zh-CN";
import zhHK from "./dict/zh-HK";
import en from "./dict/en";

const DICTS: Record<Locale, TranslationDict> = {
  "zh-CN": zhCN,
  "zh-HK": zhHK,
  en,
};

const STORAGE_KEY = "kid-aider-locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && (stored === "zh-CN" || stored === "zh-HK" || stored === "en")) {
          return stored;
        }
      } catch {}
    }
    return initialLocale;
  });

  // Hydrate from localStorage on mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (stored === "zh-CN" || stored === "zh-HK" || stored === "en") && stored !== locale) {
        setLocaleState(stored);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      const dict = DICTS[locale];
      let value = dict[key];
      if (!value) {
        // Fallback to zh-CN
        value = zhCN[key] || key;
        if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
          if (!zhCN[key]) console.warn(`[i18n] missing key: "${key}"`);
        }
      }
      if (params) {
        return value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
      }
      return value;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale() must be used inside <LocaleProvider>");
  return ctx;
}
```

- [ ] **Step 4: 创建 zh-HK 和 en 字典（空壳——Task 8 填充）**

```typescript
// lib/i18n/dict/zh-HK.ts
import type { TranslationDict } from "../types";
const zhHK: TranslationDict = {
  // Will be populated in Task 8
};
export default zhHK;
```

```typescript
// lib/i18n/dict/en.ts
import type { TranslationDict } from "../types";
const en: TranslationDict = {
  // Will be populated in Task 8
};
export default en;
```

- [ ] **Step 5: 创建 barrel export**

```typescript
// lib/i18n/index.ts
export type { Locale, TranslationDict } from "./types";
export { LOCALES, LOCALE_LABELS, detectLocale } from "./types";
export { LocaleProvider, useLocale } from "./context";
```

- [ ] **Step 6: 创建 LocaleSwitcher 组件**

```typescript
// components/ui/locale-switcher.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/lib/i18n/context";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/types";
import type { Locale } from "@/lib/i18n/types";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-2 py-1.5 rounded-btn hover:bg-surface-raised"
      >
        {LOCALE_LABELS[locale].flag}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-card shadow-lg py-1 z-50 min-w-[120px]">
          {LOCALES.map((l: Locale) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-body-sm hover:bg-surface-raised transition-colors ${
                l === locale ? "text-primary font-semibold" : "text-ink"
              }`}
            >
              {LOCALE_LABELS[l].flag} {LOCALE_LABELS[l].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: 修改 app/layout.tsx — 包裹 LocaleProvider**

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { LocaleProvider } from "@/lib/i18n/context";
import { detectLocale } from "@/lib/i18n/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kid-Aider · 儿童创意启发助手",
  description: "通过引导式对话，帮助孩子把脑海里的想法变成清晰的方案。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const acceptLanguage = headers().get("accept-language");
  const initialLocale = detectLocale(acceptLanguage);

  return (
    <html lang="zh-CN">
      <body className="bg-page min-h-screen antialiased">
        <LocaleProvider initialLocale={initialLocale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
```

注意：`LocaleProvider` 本身是 client component（`"use client"`），可以在 server component 中直接使用——Next.js 14 支持 server component 渲染 client component 作为 children。

- [ ] **Step 8: 修改 app/page.tsx — 导航栏添加 LocaleSwitcher**

在导航栏 header 的最后一个 `<Link>`（设置）之后、`</header>` 之前，插入：

```typescript
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

// ... 在设置 Link 之后:
<LocaleSwitcher />
```

- [ ] **Step 9: 编译验证 + Commit**

```bash
npx tsc --noEmit
```

期望：0 errors。

```bash
git add lib/i18n/ app/layout.tsx app/page.tsx components/ui/locale-switcher.tsx
git commit -m "feat(p8c): add i18n infrastructure — context, dictionaries, locale switcher"
```

---

### Task 2: 导航栏 + 聊天页迁移

**Files:**
- Modify: `app/page.tsx` — 导航链接文本 → t(key)
- Modify: `app/layout.tsx` — metadata title/description → 不变（metadata 是静态导入，无法用 hook）
- Modify: `components/chat/input-bar.tsx` — 输入框 placeholder、发送按钮、语音按钮文本
- Modify: `components/chat/chat-view.tsx` — 空状态提示
- Modify: `components/chat/message-list.tsx` — streaming 状态提示
- Modify: `components/chat/bubble-guide.tsx` — guide 消息模板
- Modify: `components/chat/age-switcher.tsx` — 年龄标签
- Modify: `components/chat/emotion-indicator.tsx` — 情绪标签
- Modify: `components/chat/voice-button.tsx` — 语音按钮状态
- Modify: `components/panels/side-panel.tsx` — 面板标题/提示
- Modify: `components/panels/solution-preview.tsx` — 方案按钮文本
- Modify: `components/panels/funnel-view.tsx` — 漏斗状态文本
- Modify: `components/panels/funnel-node.tsx` — 节点标签

**Interfaces:**
- Consumes: `useLocale()` from `@/lib/i18n/context`

- [ ] **Step 1-13: 逐个文件替换硬编码中文**

每个文件遵循相同的模式：

1. 添加 `import { useLocale } from "@/lib/i18n/context";`
2. 组件内 `const { t } = useLocale();`
3. 替换硬编码中文为 `t("key")`

示例 — input-bar.tsx：

```typescript
// Before:
<input placeholder="说说你想做什么吧..." />
<button>发送</button>
<button>开始语音</button>

// After:
const { t } = useLocale();
<input placeholder={t("chat.input.placeholder")} />
<button>{t("chat.input.send")}</button>
<button>{t("chat.input.voice.start")}</button>
```

**文件迁移清单（按顺序）：**

1. `app/page.tsx` — 所有 Link 文本（7 个导航链接）
2. `components/chat/input-bar.tsx` — placeholder + 按钮文本
3. `components/chat/chat-view.tsx` — 空状态提示
4. `components/chat/message-list.tsx` — streaming 状态
5. `components/chat/bubble-guide.tsx` — guide 模板文本
6. `components/chat/bubble-child.tsx` — child 消息包装
7. `components/chat/streaming-bubble.tsx` — streaming 提示
8. `components/chat/age-switcher.tsx` — 年龄标签
9. `components/chat/emotion-indicator.tsx` — 情绪标签
10. `components/chat/voice-button.tsx` — 语音按钮状态
11. `components/chat/audio-player.tsx` — 播放器标签
12. `components/panels/side-panel.tsx` — 面板文本
13. `components/panels/solution-preview.tsx` — 方案按钮
14. `components/panels/funnel-view.tsx` — 漏斗状态
15. `components/panels/funnel-node.tsx` — 节点标签

- [ ] **Step 14: 编译验证 + Commit**

```bash
npx tsc --noEmit
```

期望：0 errors。如有 key 缺失，在 zh-CN.ts 中补齐。

```bash
git add [修改的所有文件] lib/i18n/dict/zh-CN.ts
git commit -m "feat(p8c): migrate nav bar and chat page to i18n"
```

---

### Task 3: 探索页迁移

**Files:**
- Modify: `app/explore/page.tsx` — 所有 UI 文本（分类标签、按钮、状态提示）
- Modify: `components/parent/topic-detail.tsx` — 详情页文本
- Modify: `components/parent/topic-card.tsx` — 卡片文本
- Modify: `components/parent/start-project-dialog.tsx` — 弹窗文本
- Modify: `components/parent/topic-manager.tsx` — 管理页文本

**Interfaces:**
- Consumes: `useLocale()` from Task 1

迁移模式同 Task 2。

- [ ] **Step 1-5: 逐个文件替换**
- [ ] **Step 6: 编译 + Commit**

---

### Task 4: 项目工坊迁移

**Files:**
- Modify: `app/projects/page.tsx` — 项目列表页
- Modify: `app/projects/[id]/page.tsx` — 项目详情页
- Modify: `components/projects/project-card.tsx` — 项目卡片
- Modify: `components/projects/project-hero.tsx` — 项目头部
- Modify: `components/projects/track-column.tsx` — 轨道列
- Modify: `components/projects/task-card.tsx` — 任务卡片
- Modify: `components/projects/check-in-dialog.tsx` — 打卡弹窗
- Modify: `components/projects/reflection-dialog.tsx` — 复盘弹窗
- Modify: `components/projects/calendar-heatmap.tsx` — 日历热力图
- Modify: `components/projects/streak-badge.tsx` — 连击徽章

**Interfaces:**
- Consumes: `useLocale()` from Task 1

- [ ] **Step 1-10: 逐个文件替换**
- [ ] **Step 11: 编译 + Commit**

---

### Task 5: /me + 成长 + 展示 + 报告迁移

**Files:**
- Modify: `app/me/page.tsx`
- Modify: `components/me/user-card.tsx`
- Modify: `components/me/daily-summary.tsx`
- Modify: `components/me/badge-collection.tsx`
- Modify: `components/me/rank-card.tsx`
- Modify: `app/growth/page.tsx`
- Modify: `components/growth/radar-chart.tsx`
- Modify: `components/growth/trend-line.tsx`
- Modify: `components/growth/badge-card.tsx`
- Modify: `components/growth/badge-wall.tsx`
- Modify: `app/showcase/page.tsx`
- Modify: `components/showcase/project-showcase-card.tsx`
- Modify: `app/report/page.tsx`

**Interfaces:**
- Consumes: `useLocale()` from Task 1

- [ ] **Step 1-13: 逐个文件替换**
- [ ] **Step 14: 编译 + Commit**

---

### Task 6: 家长控制 + 设置迁移

**Files:**
- Modify: `app/parent/page.tsx`
- Modify: `components/parent/usage-control.tsx`
- Modify: `components/parent/filtered-words-manager.tsx`
- Modify: `components/parent/project-manager.tsx`
- Modify: `components/parent/project-detail-modal.tsx`
- Modify: `components/parent/data-panel.tsx`
- Modify: `components/parent/system-log.tsx`
- Modify: `components/parent/profile-view.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `components/settings/model-profile-form.tsx`
- Modify: `components/settings/model-profile-list.tsx`
- Modify: `components/settings/connectivity-test.tsx`

**Interfaces:**
- Consumes: `useLocale()` from Task 1

- [ ] **Step 1-12: 逐个文件替换**
- [ ] **Step 13: 编译 + Commit**

---

### Task 7: API 错误消息 + 共享 UI 组件迁移

**Files:**
- Modify: ~30 个 API 路由文件（`app/api/**/route.ts`）
- Modify: `components/ui/dialog.tsx` — 弹窗按钮文本
- Modify: `components/ui/sheet.tsx` — 面板文本
- Modify: `components/ui/dropdown-menu.tsx` — 下拉菜单
- Modify: `components/ui/tooltip.tsx` — 提示
- Modify: `components/ui/label.tsx` — 标签
- Modify: `components/ui/separator.tsx` — 分隔符标签
- Modify: `components/ui/scroll-area.tsx` — 滚动区域

**Interfaces:**
- Consumes: API 路由不消费 i18n（返回 key）；前端组件消费 `useLocale()`

**API 错误消息迁移模式：**

路由文件只改字符串，不改导入：

```typescript
// Before:
return Response.json({ error: "topic not found" }, { status: 404 });

// After:
return Response.json({ error: "error.topic_not_found" }, { status: 404 });
```

前端组件统一翻译：

```typescript
// Before:
const data = await res.json();
setError(data.error);

// After:
const data = await res.json();
setError(t(data.error));
```

- [ ] **Step 1: 批量替换 ~30 个 API 路由的 error 字符串**
- [ ] **Step 2: 迁移共享 UI 组件**
- [ ] **Step 3: 编译 + Commit**

---

### Task 8: 英文 + 繁體中文字典翻译

**Files:**
- Modify: `lib/i18n/dict/en.ts` — 填入所有 key 的英文翻译
- Modify: `lib/i18n/dict/zh-HK.ts` — 填入所有 key 的繁體中文翻译

**Interfaces:**
- 只编辑字典文件，不涉及 TypeScript 类型

**翻译规则：**
- 每个 key 必须在两个字典中都有对应值
- 英文翻译：简洁、儿童友好（目标用户为 6-15 岁儿童）
- 繁體中文：注意用词差异（如"設置"而非"设置"、"日誌"而非"日志"）
- 带有 emoji 的 key（如导航栏链接）保留 emoji + 翻译文本
- 模板插值 `{n}` 保留原样
- 字典 key 顺序与 zh-CN.ts 保持一致

- [ ] **Step 1: 完整翻译 en.ts**

```typescript
// lib/i18n/dict/en.ts
import type { TranslationDict } from "../types";

const en: TranslationDict = {
  // ─── 导航 nav ────────────────────────────────
  "nav.home": "Kid-Aider",
  "nav.me": "👤 Me",
  "nav.explore": "🔍 Explore",
  "nav.projects": "🚀 Projects",
  "nav.growth": "🌟 Growth",
  "nav.showcase": "🖼 Showcase",
  "nav.report": "📊 Report",
  "nav.settings": "⚙ Settings",
  "nav.parent": "👨‍👩‍👧 Parent",
  "nav.language": "🌐 Language",

  // ─── 聊天 chat ────────────────────────────────
  "chat.input.placeholder": "What would you like to make?",
  "chat.input.send": "Send",
  "chat.input.recording": "Recording...",
  "chat.input.voice.start": "Voice",
  "chat.input.voice.stop": "Stop",
  "chat.empty": "Tell K what you want to build, and K will help you step by step!",
  "chat.streaming": "K is thinking...",
  "chat.age.label": "Age",
  "chat.age.6-9": "6-9 yrs",
  "chat.age.10-12": "10-12 yrs",
  "chat.age.13-15": "13-15 yrs",
  "chat.emotion.excited": "Excited",
  "chat.emotion.calm": "Calm",
  "chat.emotion.curious": "Curious",
  "chat.emotion.frustrated": "Frustrated",
  "chat.emotion.confident": "Confident",

  // (continued — every key from zh-CN.ts, translated)
  // ...
};
export default en;
```

- [ ] **Step 2: 完整翻译 zh-HK.ts**

```typescript
// lib/i18n/dict/zh-HK.ts
import type { TranslationDict } from "../types";

const zhHK: TranslationDict = {
  // ─── 導航 nav ────────────────────────────────
  "nav.home": "Kid-Aider",
  "nav.me": "👤 我的",
  "nav.explore": "🔍 探索",
  "nav.projects": "🚀 項目",
  "nav.growth": "🌟 成長",
  "nav.showcase": "🖼 作品",
  "nav.report": "📊 報告",
  "nav.settings": "⚙ 設定",
  "nav.parent": "👨‍👩‍👧 家長",
  "nav.language": "🌐 語言",

  // ─── 聊天 chat ────────────────────────────────
  "chat.input.placeholder": "講講你想做咩？",
  "chat.input.send": "發送",
  "chat.input.recording": "正在錄音...",
  "chat.input.voice.start": "語音",
  "chat.input.voice.stop": "停止",
  "chat.empty": "講出你嘅諗法，K 幫你一步步實現！",
  "chat.streaming": "K 諗緊...",
  "chat.age.label": "年齡",
  "chat.age.6-9": "6-9 歲",
  "chat.age.10-12": "10-12 歲",
  "chat.age.13-15": "13-15 歲",
  "chat.emotion.excited": "興奮",
  "chat.emotion.calm": "平靜",
  "chat.emotion.curious": "好奇",
  "chat.emotion.frustrated": "挫敗",
  "chat.emotion.confident": "自信",

  // (continued — every key from zh-CN.ts, translated)
  // ...
};
export default zhHK;
```

- [ ] **Step 3: 编译 + Commit**

```bash
npx tsc --noEmit
git add lib/i18n/dict/en.ts lib/i18n/dict/zh-HK.ts
git commit -m "feat(p8c): add English and Traditional Chinese translations"
```

---

## Post-Integration Checklist

- [ ] 1. `npm run dev` — 所有页面可访问，无运行时崩溃
- [ ] 2. 导航栏语言切换按钮可见 + 可点击
- [ ] 3. 切换到 English — 导航栏、聊天页、探索页文本变为英文
- [ ] 4. 切换到繁體中文 — 文本变为繁體
- [ ] 5. 切换回简体中文 — 恢复正常
- [ ] 6. 关闭浏览器 → 重新打开 → 语言选择保持
- [ ] 7. 无痕窗口 → 语言默认为浏览器语言
- [ ] 8. P7 内容语言切换器仍然独立运作（不耦合）
- [ ] 9. 所有 API 调用正常（路由 error key 更新后）
- [ ] 10. `npx tsc --noEmit` — 0 errors
