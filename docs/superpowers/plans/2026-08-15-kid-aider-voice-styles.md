# 语音播报多音色实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给语音播报提供 5 种可选音色，在设置页选择并持久化，之后所有「朗读」用所选音色。纯前端改动。

**Architecture:** 新增纯模块 `lib/voice/voices.ts` 保存音色目录与 localStorage 读写；新增 `components/ui/voice-selector.tsx` 在设置页渲染选择器（含试听）；`components/chat/audio-player.tsx` 读当前音色并透传 `voice` 参数。后端 `/api/voice/tts` 已支持 `voice`，零改动。

**Tech Stack:** Next.js 14 App Router + TypeScript strict + Tailwind CSS v3 + 现有 i18n 字典（无新增 npm 依赖）。

## Global Constraints

- 零新增 npm 依赖。
- TypeScript strict，无 `any`。
- 后端 `app/api/voice/tts/route.ts`、`lib/voice/tts-adapter.ts` 及其缓存逻辑**不改**（已支持 `voice` 参数）。
- 不改变现有播报功能：未选音色时行为与现状一致（默认 `zh-CN-XiaoxiaoNeural` 晓晓）。
- i18n 三语覆盖新增文案。
- 无新增路由/SSE。
- 验证门禁：`npx tsc --noEmit`、`npm run lint`（无 error）、`npm run build`（本项目无测试框架）。

---

### Task 1: i18n 音色标签（三语）

**Files:**
- Modify: `lib/i18n/dict/zh-CN.ts`
- Modify: `lib/i18n/dict/zh-HK.ts`
- Modify: `lib/i18n/dict/en.ts`

**Interfaces:**
- Consumes: 无
- Produces: `settings.voice.*` 键（Task 3 的 `VoiceSelector` 通过 `t()` 消费）。

- [ ] **Step 1: 在三个字典里、紧跟现有最后一个 `"settings.*"` 键之后，各追加同一组键**

（三个文件的键名完全一致，仅值不同。保持与文件内其余键相同的缩进/引号/尾逗号风格。）

**zh-CN.ts:**

```typescript
  // ─── 语音播报音色（P11）────────────────────────────
  "settings.voice.title": "语音播报音色",
  "settings.voice.desc": "选择「朗读」时的声音风格，点击试听可先听一下。",
  "settings.voice.preview": "试听",
  "settings.voice.preview_text": "嗨，我是你的创意小助手，我们一起探索吧！",
  "settings.voice.v.xiaoxiao": "晓晓 · 温暖女声",
  "settings.voice.v.xiaoyi": "晓伊 · 温柔女声",
  "settings.voice.v.yunxi": "云希 · 阳光男声",
  "settings.voice.v.yunxia": "云夏 · 童声",
  "settings.voice.v.yunyang": "云扬 · 沉稳男声",
```

**zh-HK.ts:**

```typescript
  // ─── 語音播報音色（P11）────────────────────────────
  "settings.voice.title": "語音播報音色",
  "settings.voice.desc": "選擇「朗讀」時的聲音風格，點擊試聽可先聽一下。",
  "settings.voice.preview": "試聽",
  "settings.voice.preview_text": "嗨，我係你嘅創意小助手，一齊探索啦！",
  "settings.voice.v.xiaoxiao": "曉曉 · 溫暖女聲",
  "settings.voice.v.xiaoyi": "曉伊 · 溫柔女聲",
  "settings.voice.v.yunxi": "雲希 · 陽光男聲",
  "settings.voice.v.yunxia": "雲夏 · 童聲",
  "settings.voice.v.yunyang": "雲揚 · 沉穩男聲",
```

**en.ts:**

```typescript
  // ─── Voice style (P11) ────────────────────────────
  "settings.voice.title": "Voice style",
  "settings.voice.desc": "Choose the voice used for read-aloud. Tap preview to listen first.",
  "settings.voice.preview": "Preview",
  "settings.voice.preview_text": "Hi, I'm your creative assistant. Let's explore together!",
  "settings.voice.v.xiaoxiao": "Xiaoxiao · warm female",
  "settings.voice.v.xiaoyi": "Xiaoyi · gentle female",
  "settings.voice.v.yunxi": "Yunxi · cheerful male",
  "settings.voice.v.yunxia": "Yunxia · child",
  "settings.voice.v.yunyang": "Yunyang · steady male",
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/dict/zh-CN.ts lib/i18n/dict/zh-HK.ts lib/i18n/dict/en.ts
git commit -m "feat(p11): add voice-style i18n labels (3 locales)"
```

---

### Task 2: 音色目录 + localStorage 偏好模块

**Files:**
- Create: `lib/voice/voices.ts`

**Interfaces:**
- Consumes: 无
- Produces: `VoiceStyle` 类型、`VOICES` 数组、`DEFAULT_VOICE`、`getStoredVoice(): string`、`setStoredVoice(id: string): void`（Task 3、Task 4 消费）。

- [ ] **Step 1: 新建 `lib/voice/voices.ts`，内容如下**

```typescript
// lib/voice/voices.ts

export type VoiceStyle = {
  id: string; // Edge TTS 音色全名
  key: string; // i18n 标签键（settings.voice.v.*）
};

export const VOICES: VoiceStyle[] = [
  { id: "zh-CN-XiaoxiaoNeural", key: "settings.voice.v.xiaoxiao" },
  { id: "zh-CN-XiaoyiNeural", key: "settings.voice.v.xiaoyi" },
  { id: "zh-CN-YunxiNeural", key: "settings.voice.v.yunxi" },
  { id: "zh-CN-YunxiaNeural", key: "settings.voice.v.yunxia" },
  { id: "zh-CN-YunyangNeural", key: "settings.voice.v.yunyang" },
];

export const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";

const STORAGE_KEY = "kid-aider-voice";

const VALID_IDS = new Set(VOICES.map((v) => v.id));

export function getStoredVoice(): string {
  if (typeof window === "undefined") return DEFAULT_VOICE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_IDS.has(stored)) return stored;
  } catch {}
  return DEFAULT_VOICE;
}

export function setStoredVoice(id: string): void {
  if (typeof window === "undefined") return;
  if (!VALID_IDS.has(id)) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（无类型错误）

- [ ] **Step 3: Commit**

```bash
git add lib/voice/voices.ts
git commit -m "feat(p11): add voice catalog + localStorage preference module"
```

---

### Task 3: 设置页音色选择器

**Files:**
- Create: `components/ui/voice-selector.tsx`
- Modify: `app/settings/page.tsx`

**Interfaces:**
- Consumes: `useLocale()`（`t`）；`VOICES`/`getStoredVoice`/`setStoredVoice`（Task 2）；`settings.voice.*` i18n 键（Task 1）；`POST /api/voice/tts`（试听）。
- Produces: `<VoiceSelector />` 组件（设置页渲染）。

- [ ] **Step 1: 新建 `components/ui/voice-selector.tsx`，内容如下**

```tsx
"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { VOICES, getStoredVoice, setStoredVoice } from "@/lib/voice/voices";

export function VoiceSelector() {
  const { t } = useLocale();
  const [selected, setSelected] = useState<string>(() => getStoredVoice());
  const [previewing, setPreviewing] = useState<string | null>(null);

  const select = (id: string) => {
    setStoredVoice(id);
    setSelected(id);
  };

  const preview = async (id: string) => {
    setPreviewing(id);
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t("settings.voice.preview_text"), voice: id, speed: 1.0 }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // 试听失败静默，不影响选择
    } finally {
      setPreviewing(null);
    }
  };

  return (
    <div className="space-y-2">
      {VOICES.map((v) => {
        const active = v.id === selected;
        return (
          <div
            key={v.id}
            className={`flex items-center gap-3 rounded-btn border p-3 ${
              active ? "border-primary" : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => select(v.id)}
              className="flex-1 text-left text-body-sm font-medium"
            >
              {t(v.key)}
              {active && <span className="ml-2 text-primary">✓</span>}
            </button>
            <button
              type="button"
              onClick={() => preview(v.id)}
              disabled={previewing === v.id}
              className="text-body-xs text-ink-tertiary hover:text-primary disabled:opacity-50"
            >
              {previewing === v.id ? t("common.loading") : `🔊 ${t("settings.voice.preview")}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 修改 `app/settings/page.tsx`**

1. 在文件顶部 import 区加一行：`import { VoiceSelector } from "@/components/ui/voice-selector";`
2. 在「返回 + 标题」的 `<div>` 之后、「家长面板链接」的 `<div>` 之前，插入一个 `<section>` 区块。

改完后 `SettingsPage` 组件应为（其余不变）：

```tsx
export default function SettingsPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          {t("settings.back")}
        </Link>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </div>

      <section className="mt-8 pt-4 border-t border-border">
        <h2 className="text-body-lg font-bold mb-2">{t("settings.voice.title")}</h2>
        <p className="text-body-sm text-ink-tertiary mb-4">{t("settings.voice.desc")}</p>
        <VoiceSelector />
      </section>

      <div className="mt-8 pt-4 border-t border-border">
        <Link
          href="/parent"
          className="text-body-sm text-ink-tertiary hover:text-ink transition-colors"
        >
          {t("nav.parent")} →
        </Link>
      </div>

      <div className="mt-8">
        <AccountManager />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 全量门禁**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 无类型错误、lint 无 error、构建成功

- [ ] **Step 4: Commit**

```bash
git add components/ui/voice-selector.tsx app/settings/page.tsx
git commit -m "feat(p11): add voice selector in settings"
```

---

### Task 4: 播报透传所选音色

**Files:**
- Modify: `components/chat/audio-player.tsx`

**Interfaces:**
- Consumes: `getStoredVoice`（Task 2）；`POST /api/voice/tts`（现有）。
- Produces: 播报请求携带 `voice`；音色切换后重新拉取音频。

- [ ] **Step 1: 修改 `components/chat/audio-player.tsx`**

1. 顶部 import 区加一行：`import { getStoredVoice } from "@/lib/voice/voices";`
2. 在 `const urlRef = useRef<string | null>(null);` 之后加一行：`const voiceRef = useRef<string | null>(null);`
3. 把 `loadAndPlay` 的 `useCallback` 整体替换为以下版本（仅改了缓存判空条件、请求体、以及成功分支更新 `voiceRef`）：

```tsx
  const loadAndPlay = useCallback(async () => {
    setState("loading");
    try {
      const voice = getStoredVoice();
      let url = urlRef.current;
      if (!url || voiceRef.current !== voice) {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice, speed: 1.0 }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        urlRef.current = url;
        voiceRef.current = voice;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("error");
      await audio.play();
      setState("playing");
    } catch {
      setState("error");
    }
  }, [text]);
```

- [ ] **Step 2: 全量门禁**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 无类型错误、lint 无 error、构建成功

- [ ] **Step 3: Commit**

```bash
git add components/chat/audio-player.tsx
git commit -m "feat(p11): wire selected voice into TTS playback"
```

---

### Task 5: 部署 + 端到端验证（待用户确认后执行）

- [ ] **Step 1: 推送部署**

```bash
git push origin main
ssh root@106.15.180.105 "cd /opt/kid-aider && bash update.sh"
```

- [ ] **Step 2: 服务器端验证音色透传**

```bash
curl -s -D - -o /tmp/tts-yunxia.mp3 -X POST "http://127.0.0.1:3000/api/voice/tts" \
  -H "Content-Type: application/json" \
  -d '{"text":"你好，我是云夏","voice":"zh-CN-YunxiaNeural","speed":1.0}' | head -8
file /tmp/tts-yunxia.mp3
```

Expected:
- 响应头含 `Content-Type: audio/mpeg`。
- `file` 输出显示 `MPEG ADTS`（或同类音频），且文件非空。
- 用另一音色（如 `zh-CN-YunyangNeural`）重复一次，确认返回非空音频（后端按音色分别合成）。

- [ ] **Step 3: 设置页可达性验证**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3000/settings"
```

Expected: `200`
