// フィードの続き（MS2b #109）。クライアントの FeedPager が cursor を付けて呼ぶ。公開の読み取りだけ。
// キャッシュ（MS2c #110）：サーバー側の use cache は使わない（条件×cursor の組が件数に比例して増え、サーバーレスではインスタンスをまたいで残らない。remote は読み書きが課金対象）。
// 代わりに CDN に短く持たせる（s-maxage=30。ブラウザには持たせない）。非公開にした dest が残るのは最大 30 秒で、MS2a の「約 1 分」以内。
// 自由入力の q があるものは組が無限に増えるので持たせない。失敗・不正は no-store
import { NextResponse, type NextRequest } from "next/server";
import { parseDiscoverQuery } from "@/lib/discover-query";
import { loadFeedStrategies } from "@/lib/feed-config";
import { dbFeedApplies, FEED_UI_PAGE, FeedCursorError, getFeedPage } from "@/lib/feed-page";
import { isLocale } from "@/lib/i18n/locale";

const NO_STORE = { "Cache-Control": "no-store" };
const CDN_30S = { "Cache-Control": "public, max-age=0, s-maxage=30" };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const locale = sp.get("lang");
  if (!isLocale(locale)) return NextResponse.json({ error: "lang" }, { status: 400, headers: NO_STORE });
  // 戦略を差し替えている間は全件版（buildFeed）でトップを出していて、続きは無い
  if (!dbFeedApplies(loadFeedStrategies())) return NextResponse.json({ error: "paging-disabled" }, { status: 404, headers: NO_STORE });
  const query = parseDiscoverQuery(Object.fromEntries(sp));
  try {
    const page = await getFeedPage({ query, locale, cursor: sp.get("cursor"), limit: FEED_UI_PAGE });
    return NextResponse.json(page, { headers: query.q ? NO_STORE : CDN_30S });
  } catch (e) {
    if (e instanceof FeedCursorError) {
      return NextResponse.json({ error: e.code }, { status: e.code === "query-mismatch" ? 409 : 400, headers: NO_STORE });
    }
    console.error(e);
    return NextResponse.json({ error: "feed" }, { status: 502, headers: NO_STORE });
  }
}
