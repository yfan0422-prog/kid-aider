// lib/i18n/context.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Locale, TranslationDict } from "./types";
import zhCN from "./dict/zh-CN";
import zhHK from "./dict/zh-HK";
import en from "./dict/en";

const DICTS: Record<Locale, TranslationDict> = {
  "zh-CN": zhCN,
  "zh-HK": zhHK,
  en,
};

const STORAGE_KEY = "kid-aider-locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && (stored === "zh-CN" || stored === "zh-HK" || stored === "en")) {
          return stored;
        }
      } catch {}
    }
    return initialLocale;
  });

  // Hydrate from localStorage on mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (stored === "zh-CN" || stored === "zh-HK" || stored === "en") && stored !== locale) {
        setLocaleState(stored);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      const dict = DICTS[locale];
      let value = dict[key];
      if (!value) {
        // Fallback to zh-CN
        value = zhCN[key] || key;
        if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
          if (!zhCN[key]) console.warn(`[i18n] missing key: "${key}"`);
        }
      }
      if (params) {
        return value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
      }
      return value;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale() must be used inside <LocaleProvider>");
  return ctx;
}
