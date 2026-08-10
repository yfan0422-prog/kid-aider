# Kid-Aider P8c · 国际化 (i18n) — 设计规格

> 日期：2026-08-10
> 状态：设计完成（已确认）

## 目标

实现 UI 层面的三语言切换（简体中文 zh-CN / 繁體中文 zh-HK / English en），覆盖所有面向用户的界面文本，包括导航、组件、页面、按钮、提示、错误消息等。语言偏好持久化到 localStorage，支持即时切换无需刷新。

---

## 1. 架构

### 1.1 技术方案

React Context + 字典对象。不引入 npm 依赖，不改变路由结构。

```
lib/i18n/
  types.ts          — Locale 类型、翻译字典类型
  context.tsx        — LocaleProvider + useLocale() hook
  dict/
    zh-CN.ts        — 简体中文（源语言）
    zh-HK.ts        — 繁體中文
    en.ts           — English
```

### 1.2 字典结构

```typescript
export type Locale = "zh-CN" | "zh-HK" | "en";

// 每个文件导出 TranslationDict
const zh_CN: Record<string, string> = {
  "nav.settings": "设置",
  "chat.input.placeholder": "说说你想做什么吧...",
  // ...
};
```

### 1.3 翻译 Key 命名规约

`模块.组件.元素` 点分隔：

- `nav.*` — 导航栏
- `chat.*` — 聊天页
- `explore.*` — 探索页
- `project.*` — 项目工坊
- `me.*` — /me 仪表盘
- `growth.*` — 成长面板
- `parent.*` — 家长控制
- `settings.*` — 设置页
- `common.*` — 共享组件
- `error.*` — 错误消息

### 1.4 Context + Hook

```typescript
// LocaleProvider — 在根 layout 包裹
export function LocaleProvider({ children }: { children: React.ReactNode }) {}

// useLocale — 组件内使用
export function useLocale(): {
  t: (key: string, params?: Record<string, string>) => string;
  locale: Locale;
  setLocale: (l: Locale) => void;
} {}
```

### 1.5 语言检测与持久化

```
服务端渲染：
  Accept-Language header → 匹配 Locale → 有效 → 使用
                                       → 无效 → "zh-CN"

客户端挂载：
  localStorage("kid-aider-locale") → 有值 → 覆盖服务端检测结果
                                   → 无值 → 使用服务端检测结果
  写入 localStorage("kid-aider-locale", locale)

切换语言：
  setLocale(locale) → 更新 Context → 全树重新渲染
                   → localStorage 同步持久化
```

---

## 2. 覆盖范围

### 2.1 覆盖文件清单（~90 个文件）

| 区域 | 文件数 | 典型文本 |
|---|---|---|
| 导航层 | 3 | 导航栏链接、页头标题 |
| 聊天页 | 5 | InputBar 占位符、气泡提示、方案包预览 |
| 探索页 | 8 | 话题卡片、分类标签、语言切换按钮、内容生成状态 |
| 项目工坊 | 12 | 项目 CRUD、轨道/里程碑/任务、打卡/复盘弹窗 |
| /me 仪表盘 | 5 | 用户卡片、积分摘要、徽章墙、段位卡 |
| 成长面板 | 6 | SVG 图表标签、能力维度名 |
| 家长控制 | 8 | 使用控制、敏感词、项目管理、系统日志 |
| 设置页 | 3 | 模型配置、年龄选择 |
| 共享组件 | 10 | 确认弹窗、空状态、错误提示、加载骨架 |
| API 错误消息 | ~30 路由 | `{ error: "..." }` 改用语义化 key，前端翻译 |

### 2.2 不覆盖

- 数据库存储的文本（用户输入、AI 生成内容）— 这些内容是自然语言，不翻译
- `console.error` / `console.log` 调试输出
- 代码注释
- MD 文档文件
- P7 内容生态的 `TopicLanguage` 类型（已经独立使用，控制内容语言而非 UI 语言）

### 2.3 P7 内容语言 vs P8c UI 语言

| | P7 内容语言 | P8c UI 语言 |
|---|---|---|
| 使用方 | 探索页 `initialLanguage` | 全局 `useLocale()` |
| 作用 | 控制话题内容生成的语言版本 | 控制 UI 界面文本 |
| 存储 | TopicCatalog.language / TopicContent.language | localStorage |
| 切换器 | 探索页 LANGUAGES 数组（保留不变） | 导航栏语言切换按钮（新增） |
| 独立关系 | 两者独立——可选择英文 UI 看简体中文内容，反之亦然 |

---

## 3. 语言切换

### 3.1 切换入口

顶部导航栏右侧新增语言切换按钮：

```
┌─────────┐
│ 🇨🇳 简体  │  ← 当前选中，高亮
│ 🇭🇰 繁體  │
│ 🇬🇧 English │
└─────────┘
```

### 3.2 切换行为

- 即时重新渲染所有使用 `useLocale()` 的组件
- 无需页面刷新
- `localStorage` 同步持久化
- 关闭浏览器后重新打开自动恢复上次选择

---

## 4. 边缘情况

| 场景 | 处理 |
|---|---|
| 浏览器语言不在三语中 | 默认 zh-CN |
| localStorage 值不匹配任何 Locale | 清除 localStorage，fallback 到 Accept-Language 检测 |
| API 返回错误 key 无对应翻译 | 显示 key 原文（fallback），开发环境 console.warn |
| 服务端渲染期间无 localStorage | 从 `Accept-Language` header 检测（layout.tsx） |
| `accept-language` header 为空或无请求 | 默认 zh-CN |
| 模板插值（如 `"你好，{name}"`）| `t("greeting", { name: "小明" })` — 简单正则 `{key}` → 值替换 |
| 繁体中文用词差异 | 字典独立处理（如简"设置"→繁"設定"），不依赖自动转换 |
| key 缺失 | 开发环境 console.warn；生产环境显示 key 原文 |
| 动态内容（数字格式、日期格式）| 不处理——零新增依赖，保持系统默认格式 |

---

## 5. 实施策略

### 5.1 渐进式覆盖

1. **Phase 1 — 基础设施**：字典文件 + Context + hook + 导航栏切换器
2. **Phase 2 — 批量迁移**：按区域逐个替换硬编码中文为 `t(key)` 调用
3. **Phase 3 — API 错误消息**：路由返回语义化 key，前端翻译
4. **Phase 4 — 英文 + 繁体翻译**：完整翻译两个目标语言

### 5.2 迁移模式

**之前：**
```typescript
<button>取消</button>
```

**之后：**
```typescript
const { t } = useLocale();
<button>{t("common.cancel")}</button>
```

### 5.3 API 错误消息迁移

**之前：**
```typescript
return Response.json({ error: "topic not found" }, { status: 404 });
```

**之后：**
```typescript
return Response.json({ error: "error.topic_not_found" }, { status: 404 });
```

前端统一处理：
```typescript
if (!res.ok) {
  const data = await res.json();
  setError(t(data.error));  // t("error.topic_not_found") → "话题未找到" / "Topic not found"
}
```

---

## 6. 全局约束

- **零新增 npm 依赖** — 全部自实现
- **不改变路由结构** — 无 URL 路径前缀
- **不改变 SSE 架构**
- **TypeScript strict，无 `any`**
- **遵循项目 Tailwind token 设计系统**
- **P1-P8b 所有现有功能不受影响**
- **P7 内容语言独立运作**，不与 UI 语言耦合
- **所有文本 key 必须在 zh-CN 字典中有定义**（zh-CN 是权威源）

---

## 7. 不修改

- 数据库 schema
- API 路由逻辑（仅错误消息字符串替换）
- 对话引导引擎
- 内容生成引擎
- SSE 架构
- 已完成的 P1-P8b 功能
- MD 文档文件
