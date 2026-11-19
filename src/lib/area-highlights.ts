// area-highlights：エリアに絞り込んだときだけ出す「エリアの一言」（名産・特産・旬・便利・人気）の中身
// MS0（#113）のローカル試作：src/lib/area-local/<エリア>.json の実データから組み立てる。JSON の形は表の候補
// （products・services・shops・shop_products / shop_services）と同じにしてあり、MS1（#114）で DB に移す
import atami from "./area-local/atami.json";
import type { Locale } from "./types";

export type HighlightKind = "meisan" | "tokusan" | "shun" | "benri" | "ninki";

type L10n = { ja: string; en: string };
type Season = { from: number; to: number };
type PhotoSrc = { url: string; license: string; credit: string; source: string };

// ローカルの JSON の形（= 表の候補）
type ProductSrc = { id: string; kind: "meisan" | "tokusan"; name: L10n; summary: L10n; description?: L10n | null; season?: Season | null; photo?: PhotoSrc | null; sources: string[] };
type ServiceSrc = { id: string; name: L10n; summary: L10n; description?: L10n | null; season?: Season | null; photo?: PhotoSrc | null; sources: string[] };
type ShopSrc = { id: string; name: L10n; online: boolean; address?: string | null; lat?: number | null; lng?: number | null; hours?: string | null; closed?: string | null; url?: string | null; photos?: PhotoSrc[]; sources: string[] };
type ShopItemSrc = { shop: string; product?: string | null; service?: string | null; price?: number | null; priceNote?: string | null; checkedAt?: string | null; url?: string | null; sources: string[] };
export type AreaLocalData = { products: ProductSrc[]; services: ServiceSrc[]; shops: ShopSrc[]; shopItems: ShopItemSrc[]; popular?: string[] };

export type HighlightPhoto = PhotoSrc;
export type HighlightOffer = {
  shopId: string;
  shopName: string;
  online: boolean;
  address: string | null;
  hours: string | null;
  closed: string | null;
  price: number | null;
  priceNote: string | null;
  checkedAt: string | null;
  url: string | null;
  photos: HighlightPhoto[];
};
export type HighlightItem = {
  id: string;
  type: "product" | "service";
  name: string;
  note: string;
  description: string;
  color: string;
  photo: HighlightPhoto | null;
  season: Season | null;
  offers: HighlightOffer[];
};
export type HighlightGroup = { kind: HighlightKind; items: HighlightItem[] };

export const HIGHLIGHT_KINDS: HighlightKind[] = ["meisan", "tokusan", "shun", "benri", "ninki"];

const DATA: Record<string, AreaLocalData> = { atami: atami as AreaLocalData };

// 写真が無い候補の色面。id から決まった色を選ぶ
const PALETTE = ["#b07a4f", "#c98f3a", "#8c4a3c", "#4f6680", "#3f6f78", "#4f7a8a", "#5a6b4a", "#6b5a4a", "#7a5a7a"];
function colorOf(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// 月（1〜12）が旬の期間に入るか。年をまたぐ期間（11〜2 月）も扱う
export function inSeason(season: Season | null | undefined, month: number): boolean {
  if (!season) return false;
  return season.from <= season.to ? month >= season.from && month <= season.to : month >= season.from || month <= season.to;
}

// エリアの中なので、住所の「静岡県熱海市」までは省く
export function shortAddress(a: string | null | undefined): string | null {
  if (!a) return null;
  return a.replace(/^(\S+?[都道府県])?\S+?[市郡]/, "").trim() || a;
}

function offersOf(data: AreaLocalData, key: "product" | "service", id: string, locale: Locale): HighlightOffer[] {
  const shops = new Map(data.shops.map((s) => [s.id, s]));
  return data.shopItems
    .filter((x) => x[key] === id && shops.has(x.shop))
    .map((x) => {
      const s = shops.get(x.shop)!;
      return {
        shopId: s.id,
        shopName: s.name[locale],
        online: s.online,
        address: shortAddress(s.address),
        hours: s.hours ?? null,
        closed: s.closed ?? null,
        price: x.price ?? null,
        priceNote: x.priceNote ?? null,
        checkedAt: x.checkedAt ?? null,
        url: x.url ?? s.url ?? null,
        photos: s.photos ?? [],
      };
    })
    // 実店舗を先に、通販を最後に
    .sort((a, b) => Number(a.online) - Number(b.online));
}

function toItem(data: AreaLocalData, src: ProductSrc | ServiceSrc, type: "product" | "service", locale: Locale): HighlightItem {
  return {
    id: src.id,
    type,
    name: src.name[locale],
    note: src.summary[locale],
    description: src.description?.[locale] ?? src.summary[locale],
    color: colorOf(src.id),
    photo: src.photo ?? null,
    season: src.season ?? null,
    offers: offersOf(data, type, src.id, locale),
  };
}

// エリアの一言。全国（all）・データの無いエリアでは空の配列。候補の無い項目は出さない
// month は旬を決める月（1〜12）。省略すると今月
export function areaHighlights(area: string, locale: Locale, month: number = new Date().getMonth() + 1): HighlightGroup[] {
  if (area === "all") return [];
  const data = DATA[area];
  if (!data) return [];
  const products = data.products.map((p) => toItem(data, p, "product", locale));
  const services = data.services.map((s) => toItem(data, s, "service", locale));
  const all = [...products, ...services];
  const byId = new Map(all.map((x) => [x.id, x]));
  const kindOf = new Map(data.products.map((p) => [p.id, p.kind]));
  const lists: Record<HighlightKind, HighlightItem[]> = {
    meisan: products.filter((p) => kindOf.get(p.id) === "meisan"),
    tokusan: products.filter((p) => kindOf.get(p.id) === "tokusan"),
    shun: all.filter((x) => inSeason(x.season, month)),
    benri: services,
    ninki: (data.popular ?? []).flatMap((id) => byId.get(id) ?? []),
  };
  return HIGHLIGHT_KINDS.flatMap((kind) => (lists[kind].length === 0 ? [] : [{ kind, items: lists[kind] }]));
}
