# Kid-Aider · 语音播报多音色 — 设计规格

> 日期：2026-08-15
> 状态：设计确认

## 目标

给语音播报（消息「朗读」按钮的 TTS）提供几种可选音色，家长/孩子在设置页选一种，之后所有朗读都用该音色。纯前端改动，后端零改动。

## 现状

- 播报入口：`components/chat/audio-player.tsx` 的 `loadAndPlay()` → `POST /api/voice/tts`，请求体 `{ text, speed: 1.0 }`，**未传 `voice`**，故固定走默认音色 `zh-CN-XiaoxiaoNeural`（晓晓）。
- 后端 `lib/voice/tts-adapter.ts` 的 `synthesizeSpeech(text, { voice, speed })` 已支持任意 Edge 神经音色（`voice` 参数 + 按 `text|voice|speed` 缓存）；`app/api/voice/tts/route.ts` 已透传 `body.voice`。故后端无需改动。
- 现有 localStorage 偏好键：`kid-aider-locale`（语言，`lib/i18n/context.tsx` 读写并做合法性校验）。

## 变更

### 1. 新纯模块 `lib/voice/voices.ts`

无 React 依赖，SSR 安全（所有读 localStorage 处 `typeof window` 守卫）。

- 类型 `VoiceStyle = { id: string; key: string }`，其中 `id` 为 Edge 音色全名，`key` 为 i18n 标签键。
- `VOICES: VoiceStyle[]`（5 项，顺序即展示顺序）与 `DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"`：

| id | i18n 键 | zh-CN 标签 |
|---|---|---|
| `zh-CN-XiaoxiaoNeural` | `settings.voice.v.xiaoxiao` | 晓晓 · 温暖女声 |
| `zh-CN-XiaoyiNeural` | `settings.voice.v.xiaoyi` | 晓伊 · 温柔女声 |
| `zh-CN-YunxiNeural` | `settings.voice.v.yunxi` | 云希 · 阳光男声 |
| `zh-CN-YunxiaNeural` | `settings.voice.v.yunxia` | 云夏 · 童声 |
| `zh-CN-YunyangNeural` | `settings.voice.v.yunyang` | 云扬 · 沉稳男声 |

- `getStoredVoice(): string` — 读 `localStorage["kid-aider-voice"]`；值不在 `VOICES` 的 id 集合内时回退 `DEFAULT_VOICE`；`typeof window === "undefined"` 时直接返回 `DEFAULT_VOICE`。
- `setStoredVoice(id: string): void` — 写 `localStorage["kid-aider-voice"] = id`（仅当 `id` 合法时写入；`typeof window` 守卫）。

### 2. 新组件 `components/ui/voice-selector.tsx`（"use client"）

- 用 `useLocale()` 拿 `t`；用 `useState(getStoredVoice())` 作选中态。
- 渲染 5 个音色行，每行：音色标签 `t(v.key)` + 「🔊 试听」按钮 + 选中态（高亮/打勾）。
- 点选某行 → `setStoredVoice(id)` + `setState(id)`，立即生效。
- 试听：请求 `POST /api/voice/tts`，body `{ text: t("settings.voice.preview_text"), voice: id, speed: 1.0 }`，返回 `audio/mpeg` 用 `new Audio()` 播放；播放中禁用该行试听按钮（loading 态）。试听失败静默（控制台不抛错、界面不崩溃）。

### 3. 设置页 `app/settings/page.tsx`

在「返回 + 标题」与「家长面板链接」之间、`<AccountManager />` 之前插入一个区块，渲染 `<VoiceSelector />`，标题 `t("settings.voice.title")`、说明 `t("settings.voice.desc")`。

### 4. 播报读取音色 `components/chat/audio-player.tsx`

- 新增 `voiceRef = useRef<string | null>(null)`，记录已缓存 URL 对应的音色。
- `loadAndPlay()` 中读 `const voice = getStoredVoice()`；请求体改为 `{ text, voice, speed: 1.0 }`。
- 缓存判空条件从 `if (!url)` 改为 `if (!url || voiceRef.current !== voice)`，并在拉取成功后更新 `voiceRef.current = voice`，确保音色切换后重新拉取、不播旧音色缓存。

### 5. i18n（三语字典新增 `settings.voice.*`）

| key | zh-CN | zh-HK | en |
|---|---|---|---|
| `settings.voice.title` | 语音播报音色 | 語音播報音色 | Voice style |
| `settings.voice.desc` | 选择「朗读」时的声音风格，点击试听可先听一下。 | 選擇「朗讀」時的聲音風格，點擊試聽可先聽一下。 | Choose the voice used for read-aloud. Tap preview to listen first. |
| `settings.voice.preview` | 试听 | 試聽 | Preview |
| `settings.voice.preview_text` | 嗨，我是你的创意小助手，我们一起探索吧！ | 嗨，我係你嘅創意小助手，一齊探索啦！ | Hi, I'm your creative assistant. Let's explore together! |
| `settings.voice.v.xiaoxiao` | 晓晓 · 温暖女声 | 曉曉 · 溫暖女聲 | Xiaoxiao · warm female |
| `settings.voice.v.xiaoyi` | 晓伊 · 温柔女声 | 曉伊 · 溫柔女聲 | Xiaoyi · gentle female |
| `settings.voice.v.yunxi` | 云希 · 阳光男声 | 雲希 · 陽光男聲 | Yunxi · cheerful male |
| `settings.voice.v.yunxia` | 云夏 · 童声 | 雲夏 · 童聲 | Yunxia · child |
| `settings.voice.v.yunyang` | 云扬 · 沉稳男声 | 雲揚 · 沉穩男聲 | Yunyang · steady male |

## 全局约束

- 零新增 npm 依赖。
- TypeScript strict，无 `any`。
- 后端 `/api/voice/tts`、`lib/voice/tts-adapter.ts` 及其缓存逻辑**不改**（已支持 `voice` 参数）。
- 不改变现有播报功能：不选音色时行为与现状一致（默认晓晓）。
- i18n 三语覆盖新增文案。
- 无新增路由/SSE。

## 不变内容

- `app/api/voice/tts/route.ts`、`lib/voice/tts-adapter.ts`、`components/chat/voice-button.tsx`（ASR 输入，与本功能无关）均不动。
- 语速 `speed` 保持 `1.0` 不变（本需求只涉及音色）。
- 其余设置项、家长面板、聊天流程不动。
