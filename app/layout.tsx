import type { Metadata } from "next";
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
  return (
    <html lang="zh-CN">
      <body className="bg-page min-h-screen antialiased">{children}</body>
    </html>
  );
}
