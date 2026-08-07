"use client";

import { ChatView } from "@/components/chat/chat-view";
import { SidePanel } from "@/components/panels/side-panel";

export default function Home() {
  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <ChatView />
      </div>
      <SidePanel />
    </div>
  );
}
