"use client";

import Link from "next/link";
import { ChatView } from "@/components/chat/chat-view";
import { SidePanel } from "@/components/panels/side-panel";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* Top nav bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-white/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧒</span>
          <h1 className="text-body-lg font-bold text-ink">Kid-Aider</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            🚀 项目
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-3 py-1.5 rounded-btn hover:bg-surface-raised"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="2.5" />
              <path d="M13.5 8c0-.4-.3-.8-.6-1l.2-.8c.1-.5 0-1.1-.4-1.5l-.6-.6c-.4-.4-1-.5-1.5-.4l-.8.2c-.2-.3-.6-.6-1-.6l-1 .2c-.4-.1-.8.3-1 .6l-.8-.2c-.5-.1-1.1 0-1.5.4l-.6.6c-.4.4-.5 1-.4 1.5l.2.8c-.3.2-.6.6-.6 1l-.2 1c-.1.4.3.8.6 1l.8.2c.1.5 0 1.1.4 1.5l.6.6c.4.4 1 .5 1.5.4l.8-.2c.2.3.6.6 1 .6l1-.2c.4.1.8-.3 1-.6l.8.2c.5.1 1.1 0 1.5-.4l.6-.6c.4-.4.5-1 .4-1.5l-.2-.8c.3-.2.6-.6.6-1l.2-1c.1-.4-.3-.8-.6-1l-.8-.2z" />
            </svg>
            设置
          </Link>
        </div>
      </header>
      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <ChatView />
        </div>
        <SidePanel />
      </div>
    </div>
  );
}
