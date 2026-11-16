"use client";

// 言語の切り替え。選んだ言語を cookie に残し（次に言語の無い URL で来たとき proxy が使う）、同じページの別の言語へ移る。
// 読み込み直して移る（画面内の遷移だと、シートの intercepting route に取られて html の lang が変わらない）
import type { CSSProperties } from "react";
import { LOCALE_COOKIE, switchLocale } from "@/lib/i18n/locale";
import type { Locale } from "@/lib/types";

const OTHER: Record<Locale, { to: Locale; label: string; aria: string }> = {
  ja: { to: "en", label: "EN", aria: "Switch to English" },
  en: { to: "ja", label: "日本語", aria: "日本語に切り替える" },
};

const ONE_YEAR = 60 * 60 * 24 * 365;

export function LanguageSwitch({ locale, className, style }: { locale: Locale; className?: string; style?: CSSProperties }) {
  const { to, label, aria } = OTHER[locale];
  function onClick() {
    document.cookie = `${LOCALE_COOKIE}=${to}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    location.assign(switchLocale(location.pathname + location.search, to));
  }
  return (
    <button type="button" onClick={onClick} aria-label={aria} lang={to} data-testid="language-switch" className={className} style={style}>
      {label}
    </button>
  );
}
