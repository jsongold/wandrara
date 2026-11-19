import { Suspense } from "react";
import { HomeScreen } from "@/components/HomeScreen";
import { areaLabelOf } from "@/lib/area-sheet";
import { getCatalog, getRegions, listCategories } from "@/lib/data";
import { parseDiscoverQuery } from "@/lib/discover-query";
import { buildFeed } from "@/lib/feed";
import { loadFeedStrategies } from "@/lib/feed-config";
import { dbFeedApplies, FEED_UI_PAGE, FeedCursorError, feedQueryKey, getFeedPage, type FeedPageResult } from "@/lib/feed-page";
import { isLocale } from "@/lib/i18n/locale";
import type { DiscoverQuery, Locale } from "@/lib/types";
import { notFound } from "next/navigation";

export default function Home(props: PageProps<"/[lang]">) {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Discover params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

// 最初のページだけを読んで送る（MS2b #109）。続きはクライアントが /api/feed で取る。
// ?after=<cursor> は検索エンジンがたどる「次のページ」の入口で、その cursor の続きから 1 ページ出す（不正・別の条件なら先頭）。
// 戦略を環境変数で差し替えている間は、DB 版（既定の戦略だけ）が使えないので buildFeed の全件版にする（続きは無い）。
// これが getCatalog（dest 全件）の唯一の使い道。件数が上限（CATALOG_MAX_DESTS）を超えると getCatalog が CatalogTooLargeError を投げる（黙って重くしない）。
// その状態になったら、差し替えた戦略の DB 版を作る（feed_page を拡張する）か、差し替えを外す
async function firstPage(query: DiscoverQuery, locale: Locale, after: string | undefined): Promise<FeedPageResult> {
  const strategies = loadFeedStrategies();
  if (!dbFeedApplies(strategies)) {
    const feed = buildFeed({ catalog: await getCatalog(), query, locale }, strategies);
    return { ...feed, queryKey: feedQueryKey(query, locale), nextCursor: null, total: feed.cards.length, totalIsLowerBound: false };
  }
  try {
    return await getFeedPage({ query, locale, cursor: after, limit: FEED_UI_PAGE });
  } catch (e) {
    if (e instanceof FeedCursorError) return getFeedPage({ query, locale, limit: FEED_UI_PAGE });
    throw e;
  }
}

async function Discover({ params, searchParams }: Pick<PageProps<"/[lang]">, "params" | "searchParams">) {
  const { lang: locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const query = parseDiscoverQuery(sp);
  const after = typeof sp.after === "string" ? sp.after : undefined;
  // 全部 dest の件数に比例しない：フィードは DB が 1 ページ分、カテゴリは DB が数えた小さな一覧、エリアは今の名前だけ。
  // エリア選択シートの一覧・地図に要る地域と特性は props に載せず、シートを開いたときに /api/area-sheet から取る（MS2c）
  const [categories, feed, areaLabel] = await Promise.all([
    listCategories(query.mode, locale),
    firstPage(query, locale, after),
    query.area === "all" ? null : getRegions().then((regions) => areaLabelOf(regions, query.area, locale)),
  ]);
  return <HomeScreen locale={locale} query={query} feed={feed} categories={categories} areaLabel={areaLabel} />;
}

function HomeFallback() {
  return (
    <main className="flex h-[100dvh] items-center justify-center bg-[#0f0f0e] text-white">
      <span className="text-[15px] font-semibold tracking-[0.24em]">WANDRARA</span>
    </main>
  );
}
