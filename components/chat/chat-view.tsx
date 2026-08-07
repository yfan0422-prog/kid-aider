"use client";

import { MessageList } from "./message-list";
import { InputBar } from "./input-bar";

export function ChatView() {
  return (
    <div className="flex flex-col h-full">
      <MessageList />
      <InputBar />
    </div>
  );
}
