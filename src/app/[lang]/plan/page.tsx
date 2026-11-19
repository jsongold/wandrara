import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { SuggestPlan, type PlanCard } from "@/components/SuggestPlan";
import { getAreaSheetData, getCatalog } from "@/lib/data";
import { DEFAULT_QUERY } from "@/lib/discover-query";
import { buildFeed } from "@/lib/feed";
import { loadFeedStrategies } from "@/lib/feed-config";
import { dbFeedPlan, FEED_PAGE_MAX, getFeedPage } from "@/lib/feed-page";
import { isLocale } from "@/lib/i18n/locale";
import { SAVE_DATA_COOKIE, saveDataOfRequest } from "@/lib/save-data";
import { cardTraitIds, orderBySuggest, parseSuggestTraits, suggestReason } from "@/lib/suggest";
import type { FeedCard, Locale, Mode } from "@/lib/types";

export default function PlanPage(props: PageProps<"/[lang]/plan">) {
  return (
    <Suspense fallback={<main className="h-[100dvh] bg-[#0f0f0e]" />}>
      <Plan params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

// 宿と体験を 1 ページ分ずつ取る（試し中なので続きは取らない）
async function candidates(mode: Mode, locale: Locale): Promise<FeedCard[]> {
  const query = { ...DEFAULT_QUERY, mode };
  const strategies = loadFeedStrategies();
  const plan = dbFeedPlan(strategies);
  if (!plan) return buildFeed({ catalog: await getCatalog(), query, locale }, strategies).cards;
  return (await getFeedPage({ query, locale, limit: FEED_PAGE_MAX, plan })).cards;
}

// 宿と体験を交互に並べる（元の順。条件で並べ替えるときの同点の順になる）
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(...(i < a.length ? [a[i]] : []), ...(i < b.length ? [b[i]] : []));
  return out;
}

// 提案ページ：?t= の条件（今はエリアの特性。今後は dest が持つ条件の表に替える）に合う数の多い順に、宿と体験を並べる。絞り込みではないので件数は減らさない
async function Plan({ params, searchParams }: Pick<PageProps<"/[lang]/plan">, "params" | "searchParams">) {
  const { lang: locale } = await params;
  if (!isLocale(locale)) notFound();
  const picked = parseSuggestTraits((await searchParams).t);
  const [stay, todo, sheet, h, jar] = await Promise.all([candidates("stay", locale), candidates("do", locale), getAreaSheetData(locale), headers(), cookies()]);
  // 通信量を抑える利用者（Save-Data ヘッダか本人が選んだ cookie）。Home と同じく最初の描画から写真の画質を下げる
  const saveData = saveDataOfRequest(h.get("save-data"), jar.get(SAVE_DATA_COOKIE)?.value);
  const { traits, byRegion } = sheet.traits;
  const traitsOf = (c: FeedCard) => cardTraitIds(c.regionIds, byRegion);
  const cards: PlanCard[] = orderBySuggest(interleave(stay, todo), -1, picked, traitsOf).map((c) => ({ ...c, reason: suggestReason(traitsOf(c), picked, traits) }));
  return <SuggestPlan locale={locale} picked={picked} cards={cards} saveData={saveData} />;
}
