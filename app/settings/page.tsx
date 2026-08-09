"use client";

import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">设置</h1>
      </div>
      <div className="mt-8 pt-4 border-t border-border">
        <Link
          href="/parent"
          className="text-body-sm text-ink-tertiary hover:text-ink transition-colors"
        >
          家长控制 →
        </Link>
      </div>
    </div>
  );
}
