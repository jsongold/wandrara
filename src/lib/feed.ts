// フィードの組み立て。並べ方・メインの選び方・関連タイルの選び方の 3 戦略を独立に差し替えられる。
import { coreLabels } from "./i18n/core-labels";
import { messages } from "./i18n/messages";
import { CORES } from "./ingest/cores";
import { MODES, otherMode } from "./modes";
import type { Category, DestCard, DiscoverQuery, FeedCard, FeedPage, Locale, LocalizedText, Region, Tile } from "./types";

export type Catalog = { regions: Region[]; categories: Category[]; dests: DestCard[] };
export type Ctx = { catalog: Catalog; query: DiscoverQuery; locale: Locale };

// メインカード（並べる前）。並べ方の戦略は anchor を見る
export type PrimaryCard = Omit<FeedCard, "tiles"> & { anchor: DestCard };

export type OrderStrategy = (cards: PrimaryCard[], ctx: Ctx) => { cards: PrimaryCard[]; label: string };
export type PrimaryStrategy = (candidates: DestCard[], ctx: Ctx) => PrimaryCard[];
export type SecondaryStrategy = (cards: PrimaryCard[], ctx: Ctx) => Tile[][];

export type Strategies = { order: OrderStrategy; primary: PrimaryStrategy; secondary: SecondaryStrategy };

// ---- 表示用の小道具 ----

export function resolveLocalizedText(text: LocalizedText | null | undefined, locale: Locale): { text: string; fallback: boolean } {
  if (!text) return { text: "", fallback: false };
  const own = text[locale];
  if (own) return { text: own, fallback: false };
  const other = text.ja ?? text.en ?? "";
  return { text: other, fallback: other !== "" };
}

const t = (x: LocalizedText | null | undefined, locale: Locale) => resolveLocalizedText(x, locale).text;

export function kindLabelOf(coreType: string, locale: Locale): string {
  const core = CORES.find((c) => c.coreType === coreType);
  return core ? coreLabels(core, locale).label : "";
}

function regionIndex(regions: Region[]) {
  return new Map(regions.map((r) => [r.id, r]));
}

export function areaLabel(regionId: string | null, regions: Region[], locale: Locale): string {
  const idx = regionIndex(regions);
  const r = regionId ? idx.get(regionId) : undefined;
  if (!r) return "";
  const parent = r.parentId ? idx.get(r.parentId) : undefined;
  return parent ? `${t(parent.name, locale)}・${t(r.name, locale)}` : t(r.name, locale);
}

// 指定の地域（地域でも地区でも）に入るか
export function inArea(dest: DestCard, area: string, regions: Region[]): boolean {
  if (area === "all") return true;
  if (!dest.regionId) return false;
  if (dest.regionId === area) return true;
  return regionIndex(regions).get(dest.regionId)?.parentId === area;
}

// 地域を持たない dest は地域も無い（null）
function topRegionOf(regionId: string | null, regions: Region[]): string | null {
  if (!regionId) return null;
  return regionIndex(regions).get(regionId)?.parentId ?? regionId;
}

// ---- 候補の絞り込み ----

export function findCandidates(ctx: Ctx): DestCard[] {
  const { catalog, query } = ctx;
  const q = query.q.toLowerCase();
  return catalog.dests.filter((d) => {
    if (!inArea(d, query.area, catalog.regions)) return false;
    if (!q) return true;
    const hay = [d.name.ja, d.name.en, d.summary?.ja, d.summary?.en].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
}

// ---- メインの選び方 ----

// mode の core_type に入る dest を 1 件 1 カードにする
export const primaryByMode: PrimaryStrategy = (candidates, ctx) => {
  const { catalog, query, locale } = ctx;
  const coreTypes: readonly string[] = MODES[query.mode];
  return candidates
    .filter((d) => coreTypes.includes(d.coreType))
    .filter((d) => query.cat === "all" || d.categoryIds.includes(query.cat))
    .map((d) => ({
      key: d.id,
      title: t(d.name, locale),
      areaLabel: areaLabel(d.regionId, catalog.regions, locale),
      kindLabel: kindLabelOf(d.coreType, locale),
      relLabel: query.mode === "stay" ? messages(locale).home.relStay : messages(locale).home.relDo,
      photos: d.photos,
      href: `/${locale}/d/${d.slug}`,
      anchor: d,
    }));
};

// ---- 並べ方 ----

// 人気データが無い間は編集部の順（公開日の新しい順）。ラベルで計測値ではないことを示す
export const orderEditorial: OrderStrategy = (cards, ctx) => {
  if (ctx.query.sort === "fresh") {
    return {
      cards: [...cards].sort((a, b) => b.anchor.createdAt.localeCompare(a.anchor.createdAt)),
      label: messages(ctx.locale).home.orderFresh,
    };
  }
  return {
    cards: [...cards].sort((a, b) => (b.anchor.publishedAt ?? "").localeCompare(a.anchor.publishedAt ?? "")),
    label: messages(ctx.locale).home.orderEditorial,
  };
};

// ---- 関連タイルの選び方 ----

const MAX_TILES = 6;

function tileOf(d: DestCard, ctx: Ctx): Tile {
  return {
    destId: d.id,
    label: t(d.name, ctx.locale),
    sub: areaLabel(d.regionId, ctx.catalog.regions, ctx.locale),
    photo: d.photos[0] ?? null,
    href: `/${ctx.locale}/d/${d.slug}`,
  };
}

// もう片方の mode の dest で同じ地域のもの。同じ地区を先に出す
export const relatedOtherMode: SecondaryStrategy = (cards, ctx) => {
  const { catalog, query } = ctx;
  const coreTypes: readonly string[] = MODES[otherMode(query.mode)];
  return cards.map((card) => {
    const a = card.anchor;
    const region = topRegionOf(a.regionId, catalog.regions);
    return catalog.dests
      .filter((d) => coreTypes.includes(d.coreType) && d.id !== a.id && inArea(d, query.area, catalog.regions))
      .filter((d) => region !== null && topRegionOf(d.regionId, catalog.regions) === region)
      .sort(
        (x, y) =>
          Number(y.regionId === a.regionId) - Number(x.regionId === a.regionId) ||
          (y.publishedAt ?? "").localeCompare(x.publishedAt ?? ""),
      )
      .slice(0, MAX_TILES)
      .map((d) => tileOf(d, ctx));
  });
};

// ---- 重複の間引き（戦略とは独立） ----

// 直前のカードに出たタイルは次のカードで出さない。最低 minKeep 枚は残す
export function dedupeRelatedTiles(tilesPerCard: Tile[][], show = 3, minKeep = 1): Tile[][] {
  let prev = new Set<string>();
  return tilesPerCard.map((tiles) => {
    const fresh = tiles.filter((x) => !prev.has(x.destId));
    const picked = (fresh.length >= minKeep ? fresh : tiles).slice(0, show);
    prev = new Set(picked.map((x) => x.destId));
    return picked;
  });
}

// ---- 組み立て ----

// トップのカードに載せる写真の上限。全部の写真は詳細で見る（ページに埋め込むデータと画像の数を抑える）
export const MAX_CARD_PHOTOS = 6;

export function buildFeed(ctx: Ctx, strategies: Strategies): FeedPage {
  const candidates = findCandidates(ctx);
  const primary = strategies.primary(candidates, ctx);
  const ordered = strategies.order(primary, ctx);
  const tiles = dedupeRelatedTiles(strategies.secondary(ordered.cards, ctx));
  const cards: FeedCard[] = ordered.cards.map((c, i) => ({
    key: c.key, title: c.title, areaLabel: c.areaLabel, kindLabel: c.kindLabel, relLabel: c.relLabel,
    photos: c.photos.slice(0, MAX_CARD_PHOTOS), href: c.href, tiles: tiles[i],
  }));
  return { cards, orderLabel: ordered.label, emptyReason: cards.length === 0 ? "no-match" : null };
}
