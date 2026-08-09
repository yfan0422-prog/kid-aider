# Kid-Aider P5 · 语音互联 — 设计规格

> 日期：2026-08-09
> 状态：设计完成

## 目标

让 6 岁孩子能通过语音直接与 Kid-Aider 对话——说话→识别→感知情绪→智能回复→语音朗读。不改变现有文字交互链路，语音作为并行的输入/输出扩展。

---

## 1. 架构

```
浏览器                         服务器
┌─────────────────────┐        ┌──────────────────────────┐
│ MediaRecorder       │──WAV──→│ /api/voice/asr           │
│ (浏览器原生 API)     │        │ whisper.cpp 子进程         │
│                     │        │ → 转写文本                 │
├─────────────────────┤        ├──────────────────────────┤
│ VoiceButton         │        │ /api/voice/emotion       │
│ (按住录音/松开发送)   │        │ 规则分类 + LLM 分类       │
│                     │        │ → 情绪标签                 │
├─────────────────────┤        ├──────────────────────────┤
│ EmotionIndicator    │←─SSE──│ /api/chat (修改)          │
│ (情绪图标展示)       │        │ 系统提示词注入情绪上下文     │
├─────────────────────┤        ├──────────────────────────┤
│ AudioPlayer         │←─MP3──│ /api/voice/tts            │
│ (自动播放 AI 回复)    │        │ Edge TTS / OpenAI TTS     │
└─────────────────────┘        └──────────────────────────┘
```

**核心原则：** 语音是输入/输出扩展，不改变现有引导引擎。文字输入保留，麦克风按钮并排放置。

**技术选型：**
- ASR: whisper.cpp（本地子进程，离线，无 API 成本）
- TTS: Edge TTS 默认 + OpenAI TTS 备选（云端，中文质量好）
- 情绪: 规则快速分类 + LLM 精准分类，双轨融合
- 角色: "小K" — 活泼、温暖、耐心的 AI 伙伴

---

## 2. 组件设计

### 2.1 VoiceButton · `components/chat/voice-button.tsx`

- 麦克风图标按钮，位于文字输入框左侧
- **按住录音 / 松开发送** 交互模型
- 录音时显示波形动画（CSS 动画，不依赖第三方库）
- 状态：`idle` → `recording` → `processing` → `done`
- 处理中显示转写进度 spinner
- 权限未授权时按钮置灰 + tooltip "需要麦克风权限"
- Debounce 500ms 防止连续误触
- 快捷键：按住 Space（输入框未聚焦时）

### 2.2 AudioPlayer · `components/chat/audio-player.tsx`

- AI 文字回复下方显示音频条
- 自动播放首条回复（`autoplay` 属性，浏览器策略允许时）
- 点击可重播
- 播放状态显示小喇叭动画
- 不显示给文字输入的消息（TTS 仅用于 AI 回复）

### 2.3 EmotionIndicator · `components/chat/emotion-indicator.tsx`

- 聊天气泡旁显示情绪小图标
- 5 种情绪各有对应 emoji：🎉 😌 😟 😤 🤔
- 可选显示（设置中可关闭）
- 仅在检测到情绪变化时短暂高亮动画

### 2.4 InputBar 修改 · `components/chat/input-bar.tsx`

- 在文字输入框左侧插入 `<VoiceButton />`
- 在输入框 placeholder 添加提示 "输入文字，或按住🎤说话"
- 原有 SSE 文字发送逻辑不变

---

## 3. 数据模型

### 3.1 voice_sessions

```sql
CREATE TABLE IF NOT EXISTS voice_sessions (
  id            TEXT PRIMARY KEY,
  session_id    TEXT,
  audio_path    TEXT NOT NULL,
  transcript    TEXT,
  asr_model     TEXT NOT NULL,
  asr_time_ms   INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_session ON voice_sessions(session_id);
```

### 3.2 emotion_log

```sql
CREATE TABLE IF NOT EXISTS emotion_log (
  id             TEXT PRIMARY KEY,
  session_id     TEXT,
  source         TEXT NOT NULL CHECK(source IN ('voice', 'text', 'fused')),
  emotion        TEXT NOT NULL,
  confidence     REAL,
  voice_features TEXT,  -- JSON: {pitch, rate, volume}
  text_snippet   TEXT,
  model_used     TEXT,  -- 'rule', 'llm', 或 'rule+llm'
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emotion_log_session ON emotion_log(session_id);
```

### 3.3 文件存储

- 录音 WAV: `data/audio/recordings/` — 保留 30 天
- TTS 缓存: `data/audio/tts_cache/` — 文件名 MD5(text+voice).mp3，最多保留 100 条
- whisper 模型: `data/models/ggml-base.bin`

---

## 4. API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/voice/asr` | POST | 接收 WAV blob → whisper.cpp → 返回 `{ text, time_ms }` |
| `/api/voice/tts` | POST | 接收 `{ text, voice?, speed? }` → 返回 audio/mpeg 流 |
| `/api/voice/emotion` | POST | 接收 `{ text, voice_features?, history? }` → 规则+LLM → 返回 `{ emotion, confidence, source }` |
| `/api/voice/emotion-audio` | POST | 接收 WAV → 提取音高/语速/音量 → 返回特征 JSON |

**修改：**
- `/api/chat` — 在系统提示词前注入情绪上下文：`孩子当前情绪: {emotion}。{response_strategy}`

---

## 5. TTS 集成

```
AI 回复文本 → 截取前 500 字
  → MD5(text + voice) 查缓存
    → 命中: 直接返回缓存 MP3
    → 未命中: 调用 TTS API → 缓存 → 返回 MP3 流
```

- **默认：** Edge TTS `zh-CN-XiaoxiaoNew`（免费，微软中文女声，适合儿童）
- **备选：** OpenAI TTS（`config.models.tts` 可配，音色 `nova`）
- **语速：** 默认 1.0，家长可在设置中调整（0.8–1.5）
- **超时：** 5 秒，超时静默降级（仅显示文字）
- **音频格式：** MP3, 比特率 128kbps

---

## 6. 情绪分类

### 6.1 情绪标签（5 类）

| 标签 | 触发特征 | LLM 提示词方向 | 响应策略 |
|------|---------|---------------|---------|
| 🎉 兴奋 | 语速快、音高高、短句 | 情绪是否积极高唤醒 | 保持热情，适度引导聚焦 |
| 😌 平静 | 正常语速音高 | 情绪是否中性低唤醒 | 正常引导 |
| 😟 沮丧 | 语速慢、音高低、否定词多 | 情绪是否消极低唤醒 | 鼓励 + 降低任务难度 |
| 😤 着急 | 语速极快、重复、命令式 | 情绪是否消极高唤醒 | 安抚 + 拆解步骤 |
| 🤔 困惑 | 停顿多、疑问词多 | 情绪是否中性高唤醒 | 主动解释 + 给例子 |

### 6.2 双轨分类

```
输入 ─┬─ 第一轨：规则分类（~0ms）
      │   ├─ 文字路径: 关键词匹配 + 句式分析
      │   └─ 语音路径: 音频特征阈值（pitch/rate/volume）
      │
      └─ 第二轨：LLM 分类（~1-2s）
          └─ gpt-4o-mini / deepseek-chat
             → 取最近 3 轮对话作为上下文
             → 返回 { emotion, confidence, reason }
```

**合并策略：**
1. 规则结果立即可用（UI 显示 + 初步响应策略）
2. LLM 结果返回后覆盖规则结果
3. 若 LLM 超时（>3s），保持规则结果
4. `emotion_log.model_used` 记录实际使用的模型：
   - `"rule"` — LLM 超时，仅规则
   - `"llm"` — LLM 成功覆盖
   - `"rule+llm"` — 规则和 LLM 均参与

**LLM 情绪分类提示词模板：**
```
分析以下对话中孩子当前的情绪状态。
对话历史：
{history}

孩子最新消息：{text}

请返回 JSON：
{ "emotion": "excited|calm|frustrated|impatient|confused", "confidence": 0.0-1.0, "reason": "简要分析原因" }
```

---

## 7. 角色"小K"定义

- **名字：** 小K（K 来自 Kid-Aider）
- **性格：** 活泼、温暖、耐心，像一位懂得倾听的大姐姐/大哥哥
- **语言风格：** 使用"你"而非"您"，自然口语化，适当使用"呢""哦""啦"等语气词
- **在语音中的体现：** TTS 选活泼温暖的女声（Xiaoxiao），语速稍慢（1.0），适合 6 岁儿童听力理解
- **在文字中的体现：** 系统提示词中加入角色描述，让 LLM 以"小K"身份回复
- **在 UI 中的体现：** 可选的头像/吉祥物（留作后续 P6 视觉设计）

---

## 8. 边缘情况与错误处理

| 场景 | 处理 |
|------|------|
| 浏览器不支持 MediaRecorder | 不渲染 VoiceButton，不报错 |
| 用户拒绝麦克风权限 | toast "请允许麦克风权限以使用语音功能"，按钮置灰 |
| whisper.cpp 进程崩溃 | 自动重启，该次请求返回 "语音识别暂不可用，请稍后重试" |
| ASR 返回空文本 | 返回 `{ text: "", error: "no_speech" }`，前端提示 "没听清，可以再说一遍吗？" |
| TTS API 超时（5s） | 静默降级，仅显示文字回复 |
| 录音中切换页面 | `beforeunload` 事件停止录音，丢弃未完成片段 |
| 连续快速点击麦克风 | 按钮 debounce 500ms |
| 移动端录音 | MediaRecorder 支持 iOS Safari 14.5+/Android Chrome，无需额外适配 |
| whisper 模型缺失 | 服务启动时检查，缺失则提示下载命令 |
| TTS 缓存磁盘满 | LRU 淘汰，最多 100 条 / 100MB |

---

## 9. 全局约束

- **零新增 npm 依赖**（浏览器端使用原生 MediaRecorder API）
- 不引入第三方语音识别云服务
- 不改变现有文字聊天 SSE 架构
- whisper.cpp 以系统级二进制安装（非 npm 包），服务端 spawn 管理
- 所有语音数据保留在本地，不上传云端（ASR 端到端本地）
- TypeScript strict，无 `any` 跳过
- 遵循项目 token 设计系统（`text-ink-tertiary`, `bg-surface`, `border-border`, `rounded-card`, `rounded-btn`）
