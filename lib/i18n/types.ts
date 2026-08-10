// lib/i18n/types.ts
export type Locale = "zh-CN" | "zh-HK" | "en";

export type TranslationDict = Record<string, string>;

export const LOCALES: Locale[] = ["zh-CN", "zh-HK", "en"];

export const LOCALE_LABELS: Record<Locale, { flag: string; label: string }> = {
  "zh-CN": { flag: "🇨🇳", label: "简体中文" },
  "zh-HK": { flag: "🇭🇰", label: "繁體中文" },
  en: { flag: "🇬🇧", label: "English" },
};

export function detectLocale(acceptLanguage?: string | null): Locale {
  if (acceptLanguage) {
    for (const locale of LOCALES) {
      if (acceptLanguage.toLowerCase().startsWith(locale.toLowerCase().replace("-HK", ""))) {
        return locale;
      }
    }
  }
  return "zh-CN";
}
