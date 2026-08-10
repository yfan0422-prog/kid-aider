"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";

export default function SettingsPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          {t("settings.back")}
        </Link>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </div>
      <div className="mt-8 pt-4 border-t border-border">
        <Link
          href="/parent"
          className="text-body-sm text-ink-tertiary hover:text-ink transition-colors"
        >
          {t("nav.parent")} →
        </Link>
      </div>
    </div>
  );
}
