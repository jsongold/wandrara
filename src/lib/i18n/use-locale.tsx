"use client";

// Client Component 用：URL の言語（[lang]）と、その言語の画面の文言。
// root layout が LocaleProvider で渡す（useParams は動的な params があると Suspense の外で使えないため）
import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "../types";
import { DEFAULT_LOCALE } from "./locale";
import { messages, type Messages } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return messages(useLocale());
}
