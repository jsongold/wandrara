"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { withLocale } from "../lib/i18n/locale";
import { messages } from "../lib/i18n/messages";
import type { Locale } from "../lib/types";
import { useSaveData } from "../lib/use-save-data";
import { useSaves } from "./saves-context";

// ログイン状態は SavesProvider が持つ（getUser を二重に呼ばない）。トップをサーバーで動的にしないため client で取る。next は今の URL
export function AccountButton({ locale, next, className, style }: { locale: Locale; next: string; className?: string; style?: CSSProperties }) {
  const { signedIn } = useSaves();
  const saveData = useSaveData(); // 通信量を抑えるときは先読みしない

  const href = signedIn ? withLocale(locale, "/account") : withLocale(locale, `/login?next=${encodeURIComponent(next)}`);
  return (
    <Link href={href} prefetch={saveData ? false : undefined} aria-label={signedIn ? messages(locale).account.title : messages(locale).account.login} data-testid="account-button" className={className} style={style}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="9" r="3.5" />
        <path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
      </svg>
    </Link>
  );
}
