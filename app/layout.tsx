import type { Metadata } from "next";
import { headers } from "next/headers";
import { LocaleProvider } from "@/lib/i18n/context";
import { detectLocale } from "@/lib/i18n/types";
import { ChildProvider } from "@/components/ui/child-provider";
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
          <ChildProvider>
            {children}
          </ChildProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
