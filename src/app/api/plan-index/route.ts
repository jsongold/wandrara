// 提案シートの件数に使う、提案ページの候補の軽い一覧（カードごとに地区と種類だけ）と、おすすめの表紙・代表の場所。
// 公開の読み取りだけなので、ブラウザと CDN に 1 分持たせる
import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/lib/i18n/locale";
import { planCards } from "@/lib/plan-candidates";
import { getPresetViews } from "@/lib/suggest-presets";
import type { PlanItem } from "@/lib/suggest";

const NO_STORE = { "Cache-Control": "no-store" };
const CACHE_1MIN = { "Cache-Control": "public, max-age=60, s-maxage=60" };

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("lang");
  if (!isLocale(locale)) return NextResponse.json({ error: "lang" }, { status: 400, headers: NO_STORE });
  try {
    const [cards, presets] = await Promise.all([planCards(locale), getPresetViews(locale)]);
    const items: PlanItem[] = cards.map((c) => ({ regionIds: c.regionIds, coreType: c.coreType }));
    return NextResponse.json({ items, presets }, { headers: CACHE_1MIN });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "plan-index" }, { status: 502, headers: NO_STORE });
  }
}
