// components/ui/locale-switcher.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/lib/i18n/context";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/types";
import type { Locale } from "@/lib/i18n/types";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-body-sm text-ink-tertiary hover:text-primary transition-colors px-2 py-1.5 rounded-btn hover:bg-surface-raised"
      >
        {LOCALE_LABELS[locale].flag}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-card shadow-lg py-1 z-50 min-w-[120px]">
          {LOCALES.map((l: Locale) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-body-sm hover:bg-surface-raised transition-colors ${
                l === locale ? "text-primary font-semibold" : "text-ink"
              }`}
            >
              {LOCALE_LABELS[l].flag} {LOCALE_LABELS[l].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
