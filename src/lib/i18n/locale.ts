// 画面の言語。URL の先頭（/ja/...・/en/...）が正。無い URL は proxy が選んだ言語の URL へ送る。
// 選び方：本人が選んだ言語（cookie）> 端末の言語（Accept-Language）> ja
import type { Locale } from "../types";

export const LOCALES = ["ja", "en"] as const satisfies readonly Locale[];
export const DEFAULT_LOCALE: Locale = "ja";
/** 言語の切り替えで本人が選んだ言語。URL で開いただけでは書かない */
export const LOCALE_COOKIE = "lang";

export function isLocale(s: string | null | undefined): s is Locale {
  return (LOCALES as readonly string[]).includes(s ?? "");
}

/** Accept-Language（例 "en-US,en;q=0.9,ja;q=0.8"）から、対応する言語を q の高い順に 1 つ選ぶ */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((x) => x.lang && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  const hit = ranked.find((x) => isLocale(x.lang));
  return hit ? (hit.lang as Locale) : null;
}

export function pickLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookie)) return cookie;
  return matchAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/** パスの先頭の言語。無ければ null */
export function localeOfPath(pathname: string): Locale | null {
  const seg = pathname.split(/[/?#]/)[1];
  return isLocale(seg) ? seg : null;
}

/** 言語の付いていないパス（"/"・"/d/x"・"/?mode=do"）に言語を付ける */
export function withLocale(locale: Locale, path: string): string {
  if (path === "/" || path === "") return `/${locale}`;
  if (path.startsWith("/?") || path.startsWith("/#")) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

/** 今のパスの言語を付け替える（言語が無ければ付ける） */
export function switchLocale(path: string, locale: Locale): string {
  const current = localeOfPath(path);
  if (!current) return withLocale(locale, path);
  const rest = path.slice(current.length + 1);
  return rest === "" ? `/${locale}` : `/${locale}${rest}`;
}
