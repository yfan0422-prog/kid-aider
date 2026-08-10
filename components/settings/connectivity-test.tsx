"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";

interface Props {
  profileId: string;
}

export function ConnectivityTest({ profileId }: Props) {
  const { t } = useLocale();
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
      setResult({ connected: false, error: t("settings.model.test.error.network") });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleTest} disabled={testing}
        className="bg-surface text-ink-secondary border-2 border-border rounded-btn px-4 py-2 text-sm font-semibold hover:bg-surface-raised transition-colors disabled:opacity-50">
        {testing ? t("settings.model.testing") : t("settings.model.test")}
      </button>
      {result && (
        <span className={`text-sm font-medium ${result.connected ? "text-accent-green" : "text-[#FF6B6B]"}`}>
          {result.connected ? `✅ ${t("settings.model.test.success.short")}` : `❌ ${result.error || t("settings.model.test.fail")}`}
        </span>
      )}
    </div>
  );
}
