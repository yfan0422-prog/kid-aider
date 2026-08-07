"use client";

import { useState } from "react";

interface Props {
  profileId: string;
}

export function ConnectivityTest({ profileId }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ connected: boolean; response?: string; error?: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/config/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profileId }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ connected: false, error: "网络错误" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleTest} disabled={testing}
        className="bg-surface text-ink-secondary border-2 border-border rounded-btn px-4 py-2 text-sm font-semibold hover:bg-surface-raised transition-colors disabled:opacity-50">
        {testing ? "测试中……" : "测试连接"}
      </button>
      {result && (
        <span className={`text-sm font-medium ${result.connected ? "text-accent-green" : "text-[#FF6B6B]"}`}>
          {result.connected ? "✅ 连接成功" : `❌ ${result.error || "连接失败"}`}
        </span>
      )}
    </div>
  );
}
