import { Suspense } from "react";
import { HomeScreen } from "@/components/HomeScreen";
import { getAreaTraits, getCatalog, listAreas, listCategories } from "@/lib/data";
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
// 戦略を環境変数で差し替えている間は、DB 版（既定の戦略だけ）が使えないので buildFeed の全件版にする（続きは無い）
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
  // フィードは DB が 1 ページ分だけ読む。カテゴリ・エリア・特性はまだ全件の Catalog から作る（MS2c で小さくする）
  const [catalog, feed] = await Promise.all([getCatalog(), firstPage(query, locale, after)]);
  const traits = await getAreaTraits(catalog, locale);
  return (
    <HomeScreen
      locale={locale}
      query={query}
      feed={feed}
      categories={listCategories(catalog, query.mode, locale)}
      areas={listAreas(catalog, locale)}
      traits={traits}
    />
  );
}

function HomeFallback() {
  return (
    <main className="flex h-[100dvh] items-center justify-center bg-[#0f0f0e] text-white">
      <span className="text-[15px] font-semibold tracking-[0.24em]">WANDRARA</span>
    </main>
  );
}
