// ファイナル：Agent が仕上げた完成版を確定したもの（純関数）。保存先は final-store.ts（今はこのブラウザ）
import { siteOf, type SiteId } from "./booking-sites";
import type { FinalLink, ParsedFinal } from "./final-text";

export type FinalItem = { role: string; title: string; bookings: (FinalLink & { site: SiteId | null })[] };
export type Final = { id: string; createdAt: string; heading: string; trip: string; text: string; items: FinalItem[]; checks: string[] };

export function makeFinal(text: string, parsed: ParsedFinal, trip: string, id: string, now: Date): Final {
  return {
    id,
    createdAt: now.toISOString(),
    heading: parsed.heading,
    trip,
    text,
    items: parsed.places.map((p) => ({ role: p.role, title: p.title, bookings: p.bookings.map((b) => ({ ...b, site: siteOf({ url: b.url, isOfficial: /公式|official/i.test(b.label) }) })) })),
    checks: parsed.checks,
  };
}

/** 保存するファイルの名前（見出しの記号を除き、作った日を付ける） */
export function finalFileName(f: Pick<Final, "heading" | "createdAt">): string {
  const base = f.heading.replace(/[【】[\]（）()\\/:*?"<>|]/g, " ").replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "plan";
  return `wandrara-${base}-${f.createdAt.slice(0, 10)}.txt`;
}
