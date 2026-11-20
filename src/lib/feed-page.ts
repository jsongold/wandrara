// フィードの 1 ページ分を DB（feed_page）から読む（MS2b #109）。buildFeed の「全件を読んでから切り出す」を置き換える。
// メイン・関連タイルは buildFeed の既定（primary=by-mode・secondary=related-any-kind）と同じ。並びは editorial（buildFeed と同じ）か score（#156。DB にだけある点数）。
// それ以外の戦略に差し替えている間は buildFeed を使うこと（dbFeedPlan が null）。
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCarouselStrategy, storiesAreaOf, type CarouselEntry, type CarouselRegion } from "./carousel";
import { env, photoUrl, supabase } from "./data";
import { dedupeRelatedTiles, kindLabelOf, MAX_CARD_PHOTOS, resolveLocalizedText, type Strategies } from "./feed";
import { messages } from "./i18n/messages";
import { MODES } from "./modes";
import type { DiscoverQuery, FeedCard, FeedPage, Locale, LocalizedText, Photo, Tile } from "./types";

export const FEED_PAGE_SIZE = 12;
export const FEED_PAGE_MAX = 24;
// 画面が 1 回に出す枚数（トップの最初の描画・続きの取得とも）。写真の展開で iOS がメモリ不足にならない枚数（HomeScreen の従来の 6 枚ずつ）
export const FEED_UI_PAGE = 6;
const MAX_TILES = 6;
const PAGING = "paging=keyset@1";
const DB_REST = "primary=by-mode@2 secondary=related-any-kind@1";
export const FEED_ALGORITHM = `order=editorial@1 ${DB_REST} ${PAGING}`;
// 関連タイルは全種類から選ぶ（related-any-kind）
const ALL_CORE_TYPES: string[] = Object.values(MODES).flat();

// carousel の段は DB の後に TS で組むので、ここでは見ない（どの carousel 戦略でも DB 版を使える）
export type DbOrder = "editorial" | "score";
// DB 版で出すときの並びと、表示の記録に付ける algorithm
export type DbFeedPlan = { order: DbOrder; algorithm: string };
const EDITORIAL_PLAN: DbFeedPlan = { order: "editorial", algorithm: FEED_ALGORITHM };

// この戦略なら DB 版で出せる（メイン・関連タイルが既定で、並びが editorial か score）。それ以外は null で、呼び出し側は buildFeed の全件版を使う
export function dbFeedPlan(strategies: Strategies): DbFeedPlan | null {
  const m = /^order=(editorial|score)@\d+ (.*)$/.exec(strategies.id);
  if (!m || m[2] !== DB_REST) return null;
  return { order: m[1] as DbOrder, algorithm: `${strategies.id} ${PAGING}` };
}

export function dbFeedApplies(strategies: Strategies): boolean {
  return dbFeedPlan(strategies) !== null;
}

// DB に渡す並び。新着順（fresh）は戦略によらず作成日の順
type DbSort = "editorial" | "fresh" | "score";
const dbSortOf = (query: DiscoverQuery, order: DbOrder): DbSort => (query.sort === "fresh" ? "fresh" : order);

// ---- 結果 ----

export type FeedPageResult = FeedPage & {
  queryKey: string;              // この結果が答えた条件。クライアントは今の条件と違う結果を捨てる
  nextCursor: string | null;     // 続きが無ければ null
  total: number | null;          // 先頭ページ（cursor なし）だけ。1000 件を超えたら 1000 で totalIsLowerBound = true
  totalIsLowerBound: boolean;
};

export class FeedCursorError extends Error {
  constructor(readonly code: "invalid" | "query-mismatch") {
    super(`feed cursor: ${code}`);
  }
}

// 条件の同一性。cursor と結果に入れ、別の条件の cursor・結果を取り違えない。
// 点数の順は並びの値の形が違う（時刻でなく数）ので、別の条件として扱う（戦略を切り替えた直後の古い cursor を読まない）
// carouselId：カルーセルの戦略（例：carousel=stories-first-once@1）。戦略が変わったら古い cursor を query-mismatch にして、
// 先頭から取り直させる（並べ方と同じ。続きのページだけ新しい戦略で、記録には古い戦略が付くのを防ぐ）
export function feedQueryKey(query: DiscoverQuery, locale: Locale, order: DbOrder = "editorial", carouselId?: string): string {
  const key = [locale, query.mode, query.area, query.cat, query.sort, query.q];
  const withOrder = dbSortOf(query, order) === "score" ? [...key, "score"] : key;
  return JSON.stringify(carouselId ? [...withOrder, carouselId] : withOrder);
}

// ---- cursor ----

// k：最後のカードの並びの値（DB が返した文字列をそのまま戻す）、i：その dest_id、p：その最後のカードに出した関連タイルの destId
// （次のページの最初のカードの重複の間引きに使う。これで、ページを順にたどった結果は buildFeed の全件の結果と一致する）
// a：最後のカードのエリアの一言のエリア（無ければ null）。carousel の戦略が「前のカードと同じエリアなら出さない」を決めるのに使う。a の無い古い cursor も受ける
type Cursor = { v: 1; q: string; k: string; i: string; p: string[]; a?: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AREA = /^[\w-]{1,64}$/;
const KEY = /^(-infinity|\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?)$/;
// 点数の順の並びの値（double precision を DB が文字にしたもの）
const SCORE_KEY = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string, queryKey: string, sort: DbSort = "editorial"): Cursor {
  let c: Cursor;
  try {
    c = JSON.parse(Buffer.from(raw, "base64url").toString());
  } catch {
    throw new FeedCursorError("invalid");
  }
  const ok = c && c.v === 1 && typeof c.q === "string" && typeof c.k === "string" && typeof c.i === "string" && UUID.test(c.i) &&
    Array.isArray(c.p) && c.p.length <= MAX_TILES && c.p.every((x) => typeof x === "string" && UUID.test(x)) &&
    (c.a === undefined || c.a === null || (typeof c.a === "string" && AREA.test(c.a)));
  if (!ok) throw new FeedCursorError("invalid");
  // 条件の違いを並びの値の形より先に見る。並べ方が変わった直後の古い cursor は値の形も違うが、query-mismatch（409）にして先頭から取り直させる
  if (c.q !== queryKey) throw new FeedCursorError("query-mismatch");
  if (!(sort === "score" ? SCORE_KEY : KEY).test(c.k)) throw new FeedCursorError("invalid");
  return c;
}

// ---- DB の行 → 画面の形 ----

type PhotoRow = { storage_key: string; license: string | null; credit: string | null };
type RegionNames = { region_name: LocalizedText | null; parent_region_name: LocalizedText | null };
type TileRow = RegionNames & { dest_id: string; slug: string; name: LocalizedText | null; photo: PhotoRow | null };
// region_id・parent_region_id は 20261119140000 から。入る前の DB では無い（カルーセルのエリアの一言を出さないだけ）
type CardRow = RegionNames & {
  region_id?: string | null; parent_region_id?: string | null;
  dest_id: string; core_type: string; slug: string; name: LocalizedText | null; photos: PhotoRow[]; sort_key: string; tiles: TileRow[];
};
type RpcResult = { cards: CardRow[]; has_more: boolean; total: number | null; total_capped: boolean };

const t = (x: LocalizedText | null | undefined, locale: Locale) => resolveLocalizedText(x, locale).text;

// areaLabel（feed.ts）と同じ：親があれば「親・地区」、地域が無ければ空
function areaLabelOf(r: RegionNames, locale: Locale): string {
  if (!r.region_name) return "";
  return r.parent_region_name ? `${t(r.parent_region_name, locale)}・${t(r.region_name, locale)}` : t(r.region_name, locale);
}

function toPhoto(baseUrl: string, p: PhotoRow): Photo {
  return { url: photoUrl(baseUrl, p.storage_key), license: p.license, credit: p.credit, isDemo: false, placeholderSky: null, placeholderLand: null };
}

function toTile(row: TileRow, baseUrl: string, locale: Locale): Tile {
  return {
    destId: row.dest_id,
    label: t(row.name, locale),
    sub: areaLabelOf(row, locale),
    photo: row.photo ? toPhoto(baseUrl, row.photo) : null,
    href: `/${locale}/d/${row.slug}`,
  };
}

// カードの地区とその親（カルーセルのエリアの一言を引く順）
function regionsOf(c: CardRow, locale: Locale): CarouselRegion[] {
  const out: CarouselRegion[] = [];
  if (c.region_id) out.push({ id: c.region_id, name: t(c.region_name, locale) });
  if (c.parent_region_id) out.push({ id: c.parent_region_id, name: t(c.parent_region_name, locale) });
  return out;
}

// ---- 取得 ----

// carousel：カルーセルに何を並べるか（既定は環境変数 CAROUSEL_STRATEGY）
export type FeedPageArgs = { query: DiscoverQuery; locale: Locale; cursor?: string | null; limit?: number; plan?: DbFeedPlan; carousel?: CarouselEntry };

export async function fetchFeedPage(db: SupabaseClient, baseUrl: string, args: FeedPageArgs): Promise<FeedPageResult> {
  const { query, locale, carousel = loadCarouselStrategy() } = args;
  const plan = args.plan ?? EDITORIAL_PLAN;
  const sort = dbSortOf(query, plan.order);
  const queryKey = feedQueryKey(query, locale, plan.order, carousel.id);
  const cursor = args.cursor ? decodeCursor(args.cursor, queryKey, sort) : null;
  const limit = Math.min(Math.max(Math.trunc(args.limit ?? FEED_PAGE_SIZE), 1), FEED_PAGE_MAX);

  const { data, error } = await db.rpc("feed_page", {
    p_core_types: [...MODES[query.mode]],
    p_related_core_types: ALL_CORE_TYPES,
    p_area: query.area,
    p_cat: query.cat,
    p_q: query.q,
    p_sort: sort,
    p_limit: limit,
    p_after_key: sort === "score" ? null : (cursor?.k ?? null),
    p_after_id: cursor?.i ?? null,
    p_with_total: !cursor,
    p_tiles: MAX_TILES,
    p_after_score: sort === "score" && cursor ? Number(cursor.k) : null,
  });
  if (error) throw new Error(`feed_page: ${error.message}`);
  const res = data as RpcResult;

  const m = messages(locale).home;
  const tiles = dedupeRelatedTiles(res.cards.map((c) => c.tiles.map((x) => toTile(x, baseUrl, locale))), MAX_TILES, 1, cursor?.p);
  const regions = res.cards.map((c) => regionsOf(c, locale));
  const items = carousel.run(regions.map((r, i) => ({ tiles: tiles[i], regions: r })), { locale, prevArea: cursor?.a ?? null });
  const cards: FeedCard[] = res.cards.map((c, i) => ({
    key: c.dest_id,
    destId: c.dest_id,
    title: t(c.name, locale),
    areaLabel: areaLabelOf(c, locale),
    kindLabel: kindLabelOf(c.core_type, locale),
    relLabel: m.relNearby,
    photos: c.photos.slice(0, MAX_CARD_PHOTOS).map((p) => toPhoto(baseUrl, p)),
    href: `/${locale}/d/${c.slug}`,
    carousel: items[i],
    regionIds: regions[i].map((r) => r.id),
    coreType: c.core_type,
  }));
  const last = res.cards.at(-1);
  return {
    cards,
    orderLabel: sort === "fresh" ? m.orderFresh : sort === "score" ? m.orderScore : m.orderEditorial,
    algorithm: `${plan.algorithm} ${carousel.id}`,
    emptyReason: cards.length === 0 && !cursor ? "no-match" : null,
    queryKey,
    nextCursor: res.has_more && last ? encodeCursor({ v: 1, q: queryKey, k: last.sort_key, i: last.dest_id, p: tiles.at(-1)!.map((x) => x.destId), a: storiesAreaOf(regions.at(-1)!, locale)?.id ?? null }) : null,
    total: cursor ? null : res.total,
    totalIsLowerBound: !cursor && res.total_capped,
  };
}

// 公開の読み取りだけなので、誰にでも同じ内容だが、キャッシュはしない（条件×ページの組が件数に比例して増えるため。UI のつなぎ込み（part 2）で決める）
export function getFeedPage(args: FeedPageArgs): Promise<FeedPageResult> {
  return fetchFeedPage(supabase(), env().url, args);
}
