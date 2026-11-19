// フィードの 1 ページ分を DB（feed_page）から読む（MS2b #109）。buildFeed の「全件を読んでから切り出す」を置き換える。
// 並び・メイン・関連タイルは buildFeed の既定（order=editorial・primary=by-mode・secondary=related-any-kind）と同じ。
// 環境変数で戦略を差し替えている間は buildFeed を使うこと（この関数は既定の戦略しか持たない）。
import type { SupabaseClient } from "@supabase/supabase-js";
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
export const FEED_ALGORITHM = "order=editorial@1 primary=by-mode@2 secondary=related-any-kind@1 paging=keyset@1";
// 関連タイルは全種類から選ぶ（related-any-kind）
const ALL_CORE_TYPES: string[] = Object.values(MODES).flat();

// この戦略なら DB 版で出せる（既定の 3 戦略）。環境変数で差し替えているときは false で、呼び出し側は buildFeed の全件版を使う
export function dbFeedApplies(strategies: Strategies): boolean {
  return `${strategies.id} paging=keyset@1` === FEED_ALGORITHM;
}

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

// 条件の同一性。cursor と結果に入れ、別の条件の cursor・結果を取り違えない
export function feedQueryKey(query: DiscoverQuery, locale: Locale): string {
  return JSON.stringify([locale, query.mode, query.area, query.cat, query.sort, query.q]);
}

// ---- cursor ----

// k：最後のカードの並びの値（DB が返した文字列をそのまま戻す）、i：その dest_id、p：その最後のカードに出した関連タイルの destId
// （次のページの最初のカードの重複の間引きに使う。これで、ページを順にたどった結果は buildFeed の全件の結果と一致する）
type Cursor = { v: 1; q: string; k: string; i: string; p: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^(-infinity|\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?)$/;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string, queryKey: string): Cursor {
  let c: Cursor;
  try {
    c = JSON.parse(Buffer.from(raw, "base64url").toString());
  } catch {
    throw new FeedCursorError("invalid");
  }
  const ok = c && c.v === 1 && typeof c.q === "string" && typeof c.k === "string" && KEY.test(c.k) && typeof c.i === "string" && UUID.test(c.i) &&
    Array.isArray(c.p) && c.p.length <= MAX_TILES && c.p.every((x) => typeof x === "string" && UUID.test(x));
  if (!ok) throw new FeedCursorError("invalid");
  if (c.q !== queryKey) throw new FeedCursorError("query-mismatch");
  return c;
}

// ---- DB の行 → 画面の形 ----

type PhotoRow = { storage_key: string; license: string | null; credit: string | null };
type RegionNames = { region_name: LocalizedText | null; parent_region_name: LocalizedText | null };
type TileRow = RegionNames & { dest_id: string; slug: string; name: LocalizedText | null; photo: PhotoRow | null };
type CardRow = RegionNames & {
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

// ---- 取得 ----

export type FeedPageArgs = { query: DiscoverQuery; locale: Locale; cursor?: string | null; limit?: number };

export async function fetchFeedPage(db: SupabaseClient, baseUrl: string, args: FeedPageArgs): Promise<FeedPageResult> {
  const { query, locale } = args;
  const queryKey = feedQueryKey(query, locale);
  const cursor = args.cursor ? decodeCursor(args.cursor, queryKey) : null;
  const limit = Math.min(Math.max(Math.trunc(args.limit ?? FEED_PAGE_SIZE), 1), FEED_PAGE_MAX);

  const { data, error } = await db.rpc("feed_page", {
    p_core_types: [...MODES[query.mode]],
    p_related_core_types: ALL_CORE_TYPES,
    p_area: query.area,
    p_cat: query.cat,
    p_q: query.q,
    p_sort: query.sort,
    p_limit: limit,
    p_after_key: cursor?.k ?? null,
    p_after_id: cursor?.i ?? null,
    p_with_total: !cursor,
    p_tiles: MAX_TILES,
  });
  if (error) throw new Error(`feed_page: ${error.message}`);
  const res = data as RpcResult;

  const m = messages(locale).home;
  const tiles = dedupeRelatedTiles(res.cards.map((c) => c.tiles.map((x) => toTile(x, baseUrl, locale))), MAX_TILES, 1, cursor?.p);
  const cards: FeedCard[] = res.cards.map((c, i) => ({
    key: c.dest_id,
    destId: c.dest_id,
    title: t(c.name, locale),
    areaLabel: areaLabelOf(c, locale),
    kindLabel: kindLabelOf(c.core_type, locale),
    relLabel: m.relNearby,
    photos: c.photos.slice(0, MAX_CARD_PHOTOS).map((p) => toPhoto(baseUrl, p)),
    href: `/${locale}/d/${c.slug}`,
    tiles: tiles[i],
  }));
  const last = res.cards.at(-1);
  return {
    cards,
    orderLabel: query.sort === "fresh" ? m.orderFresh : m.orderEditorial,
    algorithm: FEED_ALGORITHM,
    emptyReason: cards.length === 0 && !cursor ? "no-match" : null,
    queryKey,
    nextCursor: res.has_more && last ? encodeCursor({ v: 1, q: queryKey, k: last.sort_key, i: last.dest_id, p: tiles.at(-1)!.map((x) => x.destId) }) : null,
    total: cursor ? null : res.total,
    totalIsLowerBound: !cursor && res.total_capped,
  };
}

// 公開の読み取りだけなので、誰にでも同じ内容だが、キャッシュはしない（条件×ページの組が件数に比例して増えるため。UI のつなぎ込み（part 2）で決める）
export function getFeedPage(args: FeedPageArgs): Promise<FeedPageResult> {
  return fetchFeedPage(supabase(), env().url, args);
}
