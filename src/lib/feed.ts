// フィードの組み立て。並べ方・メインの選び方・関連タイルの選び方の 3 戦略を独立に差し替えられる。
import type { Area, Category, DiscoverQuery, FeedCard, FeedPage, Locale, LocalizedText, Spot, Tile } from "./types";

export type Catalog = { areas: Area[]; categories: Category[]; spots: Spot[] };
export type Ctx = { catalog: Catalog; query: DiscoverQuery; locale: Locale };

// メインカード（並べる前）。sortKey 系の値は並べ方の戦略が使う
export type PrimaryCard = Omit<FeedCard, "tiles"> & { anchor: Spot; members: Spot[] };

export type OrderStrategy = (cards: PrimaryCard[], ctx: Ctx) => { cards: PrimaryCard[]; label: string };
export type PrimaryStrategy = (candidates: Spot[], ctx: Ctx) => PrimaryCard[];
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

const KIND_LABEL: Record<Spot["kind"], string> = { stay: "宿", place: "スポット", experience: "体験" };

function areaIndex(areas: Area[]) {
  return new Map(areas.map((a) => [a.id, a]));
}

export function areaLabel(areaId: string, areas: Area[], locale: Locale): string {
  const idx = areaIndex(areas);
  const a = idx.get(areaId);
  if (!a) return "";
  const parent = a.parentId ? idx.get(a.parentId) : undefined;
  return parent ? `${t(parent.name, locale)}・${t(a.name, locale)}` : t(a.name, locale);
}

// 指定エリア（地域でも地区でも）に入るか
export function inArea(spot: Spot, area: string, areas: Area[]): boolean {
  if (area === "all") return true;
  if (spot.areaId === area) return true;
  return areaIndex(areas).get(spot.areaId)?.parentId === area;
}

function regionOf(areaId: string, areas: Area[]): string {
  const a = areaIndex(areas).get(areaId);
  return a?.parentId ?? areaId;
}

// ---- 候補の絞り込み ----

export function findCandidates(ctx: Ctx): Spot[] {
  const { catalog, query } = ctx;
  const q = query.q.toLowerCase();
  return catalog.spots.filter((s) => {
    if (!inArea(s, query.area, catalog.areas)) return false;
    if (!q) return true;
    const hay = [s.name.ja, s.name.en, s.summary?.ja, s.summary?.en].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
}

// ---- メインの選び方 ----

// Place はスポット単位、Experience は体験の種類ごとにまとめる
export const primaryByMode: PrimaryStrategy = (candidates, ctx) => {
  const { catalog, query, locale } = ctx;
  const cats = catalog.categories.filter((c) => c.mode === query.mode);
  const catIds = new Set(cats.map((c) => c.id));

  if (query.mode === "place") {
    return candidates
      .filter((s) => s.kind !== "experience")
      .filter((s) => (query.cat === "all" ? s.categoryIds.some((id) => catIds.has(id)) : s.categoryIds.includes(query.cat)))
      .map((s) => ({
        key: s.id,
        title: t(s.name, locale),
        areaLabel: areaLabel(s.areaId, catalog.areas, locale),
        kindLabel: KIND_LABEL[s.kind],
        relLabel: "関連する体験",
        hero: s.photos[0] ?? null,
        href: `/spots/${s.id}`,
        anchor: s,
        members: [s],
      }));
  }

  return [...cats]
    .sort((a, b) => a.sort - b.sort)
    .filter((c) => query.cat === "all" || c.id === query.cat)
    .flatMap((c) => {
      const members = candidates.filter((s) => s.categoryIds.includes(c.id));
      if (members.length === 0) return [];
      const anchor = [...members].sort((a, b) => a.editorialRank - b.editorialRank)[0];
      const scope = query.area === "all" ? "" : `（${areaLabel(query.area, catalog.areas, locale)}）`;
      return [{
        key: `exp-${c.id}`,
        title: t(c.name, locale),
        areaLabel: `${members.length}か所で体験できる${scope}`,
        kindLabel: "体験",
        relLabel: "体験できる場所",
        hero: anchor.photos[0] ?? null,
        href: `/spots/${anchor.id}`,
        anchor,
        members,
      }];
    });
};

// ---- 並べ方 ----

// 人気データが無い間は編集部の順。ラベルで計測値ではないことを示す
export const orderEditorial: OrderStrategy = (cards, ctx) => {
  if (ctx.query.sort === "fresh") {
    return {
      cards: [...cards].sort((a, b) => b.anchor.createdAt.localeCompare(a.anchor.createdAt)),
      label: "新着順",
    };
  }
  return {
    cards: [...cards].sort((a, b) => a.anchor.editorialRank - b.anchor.editorialRank),
    label: "編集部のおすすめ順",
  };
};

// ---- 関連タイルの選び方 ----

const MAX_TILES = 6;

function tileOf(s: Spot, ctx: Ctx): Tile {
  return {
    spotId: s.id,
    label: t(s.name, ctx.locale),
    sub: areaLabel(s.areaId, ctx.catalog.areas, ctx.locale),
    photo: s.photos[0] ?? null,
    href: `/spots/${s.id}`,
  };
}

// 場所カード：同じ地区 → 同じ地域の体験。体験カード：その体験ができる場所
export const relatedExperiences: SecondaryStrategy = (cards, ctx) => {
  const { catalog, query } = ctx;
  return cards.map((card) => {
    if (query.mode === "experience") {
      return card.members.filter((s) => s.id !== card.anchor.id).concat(card.anchor).slice(0, MAX_TILES).map((s) => tileOf(s, ctx));
    }
    const a = card.anchor;
    const region = regionOf(a.areaId, catalog.areas);
    return catalog.spots
      .filter((s) => s.kind === "experience" && s.id !== a.id && inArea(s, query.area, catalog.areas))
      .filter((s) => regionOf(s.areaId, catalog.areas) === region)
      .sort((x, y) => Number(y.areaId === a.areaId) - Number(x.areaId === a.areaId) || x.editorialRank - y.editorialRank)
      .slice(0, MAX_TILES)
      .map((s) => tileOf(s, ctx));
  });
};

// ---- 重複の間引き（戦略とは独立） ----

// 直前のカードに出たタイルは次のカードで出さない。最低 minKeep 枚は残す
export function dedupeRelatedTiles(tilesPerCard: Tile[][], show = 3, minKeep = 1): Tile[][] {
  let prev = new Set<string>();
  return tilesPerCard.map((tiles) => {
    const fresh = tiles.filter((x) => !prev.has(x.spotId));
    const picked = (fresh.length >= minKeep ? fresh : tiles).slice(0, show);
    prev = new Set(picked.map((x) => x.spotId));
    return picked;
  });
}

// ---- 組み立て ----

export function buildFeed(ctx: Ctx, strategies: Strategies): FeedPage {
  const candidates = findCandidates(ctx);
  const primary = strategies.primary(candidates, ctx);
  const ordered = strategies.order(primary, ctx);
  const tiles = dedupeRelatedTiles(strategies.secondary(ordered.cards, ctx));
  const cards: FeedCard[] = ordered.cards.map((c, i) => ({
    key: c.key, title: c.title, areaLabel: c.areaLabel, kindLabel: c.kindLabel, relLabel: c.relLabel, hero: c.hero, href: c.href, tiles: tiles[i],
  }));
  return { cards, orderLabel: ordered.label, emptyReason: cards.length === 0 ? "no-match" : null };
}
