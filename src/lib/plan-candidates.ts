// 提案ページの候補：宿と体験を 1 ページ分ずつ取り、交互に並べる（試し中なので続きは取らない）。
// 提案ページ（並べ替え）と /api/plan-index（シートの件数）が同じ候補を使う
import { getCatalog } from "./data";
import { DEFAULT_QUERY } from "./discover-query";
import { buildFeed } from "./feed";
import { loadFeedStrategies } from "./feed-config";
import { dbFeedPlan, FEED_PAGE_MAX, getFeedPage } from "./feed-page";
import type { FeedCard, Locale, Mode } from "./types";

async function candidates(mode: Mode, locale: Locale): Promise<FeedCard[]> {
  const query = { ...DEFAULT_QUERY, mode };
  const strategies = loadFeedStrategies();
  const plan = dbFeedPlan(strategies);
  if (!plan) return buildFeed({ catalog: await getCatalog(), query, locale }, strategies).cards;
  return (await getFeedPage({ query, locale, limit: FEED_PAGE_MAX, plan })).cards;
}

// 宿と体験を交互に並べる（元の順。条件で並べ替えるときの同点の順になる）
export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(...(i < a.length ? [a[i]] : []), ...(i < b.length ? [b[i]] : []));
  return out;
}

export async function planCards(locale: Locale): Promise<FeedCard[]> {
  const [stay, todo] = await Promise.all([candidates("stay", locale), candidates("do", locale)]);
  return interleave(stay, todo);
}
