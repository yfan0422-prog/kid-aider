export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="rounded-bubble bg-bubble-child px-6 py-3 text-body text-ink">
          你好，我是 Kid-Aider！
        </span>
        <h1 className="font-rounded text-3xl font-bold text-primary">
          Kid-Aider · 儿童创意启发助手
        </h1>
        <p className="text-body text-ink-secondary">
          通过引导式对话，帮你把脑海里的想法变成清晰的方案。
        </p>
        <p className="rounded-btn bg-brand px-5 py-3 text-body-sm font-medium text-white">
          脚手架已就绪 · Tailwind 与设计系统已接入
        </p>
      </div>
    </main>
  );
}
