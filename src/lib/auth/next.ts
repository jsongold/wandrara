import { localeOfPath, withLocale } from "../i18n/locale";
import { createClient } from "../supabase/server";
import type { Locale } from "../types";

// ログイン後の戻り先。同じサイトの相対パス以外は "/" にする
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f]/.test(raw)) return "/";
  return raw;
}

/** ログイン後の戻り先を、言語つきの同じサイトのパスにする。言語が無ければ lang を付け、無効なら /<lang> */
export function localizedNextPath(raw: string | null | undefined, lang: Locale): string {
  const safe = safeNextPath(raw);
  if (safe === "/") return `/${lang}`;
  return localeOfPath(safe) ? safe : withLocale(lang, safe);
}

/** 認証の戻り先（/auth/callback）の行き先。言語は next の言語、無ければ fallback（cookie・端末の言語）。失敗はその言語のエラー画面 */
export function callbackTargets(rawNext: string | null | undefined, fallback: Locale): { next: string; error: string } {
  const lang = localeOfPath(safeNextPath(rawNext)) ?? fallback;
  return { next: localizedNextPath(rawNext, lang), error: `/${lang}/auth/error` };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
