// Supabase からコンテンツを読む。誰にでも同じ内容なので 'use cache' でまとめて持つ。
import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { areaTraitsOf, type RegionTraitRow, type TraitRow } from "./area-traits";
import type { AreaTraits } from "./area-filter";
import { resolveLocalizedText, type Catalog } from "./feed";
import { selectAll } from "./supabase/select-all";
import { MODES } from "./modes";
import type { AreaGroupView, CategoryView, DestCard, Locale, LocalizedText, Mode, Photo } from "./types";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が未設定です");
  return { url, key };
}

function supabase() {
  const { url, key } = env();
  return createClient(url, key, { auth: { persistSession: false } });
}

type PhotoRow = { storage_key: string; license: string | null; credit: string | null };

type DestCardRow = {
  dest_id: string;
  core_type: string;
  slug: string;
  is_demo: boolean;
  created_at: string;
  published_at: string | null;
  region_id: string | null;
  name: LocalizedText | null;
  summary: LocalizedText | null;
  category_ids: string[];
  photos: PhotoRow[];
};

export function photoUrl(baseUrl: string, storageKey: string): string {
  return `${baseUrl}/storage/v1/object/public/dest-photos/${storageKey}`;
}

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("minutes");
  const { url } = env();
  const db = supabase();
  const [regions, categories, dests] = await Promise.all([
    // regions は 1000 行を超える（Data API は黙って切る）のでページを送って読み切る
    selectAll<{ id: string; parent_id: string | null; name: LocalizedText; sort: number | null }>(db, "regions", "id, parent_id, name, sort", ["sort", "id"])
      .then((data) => ({ data, error: null }), (e: Error) => ({ data: null, error: e })),
    db.from("categories").select("id, parent_id, name, icon, sort").order("sort"),
    db.from("dest_cards").select("dest_id, core_type, slug, is_demo, created_at, published_at, region_id, name, summary, category_ids, photos"),
  ]);
  if (regions.error || categories.error || dests.error) {
    const err = regions.error ?? categories.error ?? dests.error;
    throw new Error(`Supabase の読み込みに失敗しました: ${err?.message}`);
  }
  const toPhoto = (p: PhotoRow): Photo => ({
    url: photoUrl(url, p.storage_key), license: p.license, credit: p.credit, isDemo: false, placeholderSky: null, placeholderLand: null,
  });
  return {
    regions: regions.data!.map((r) => ({ id: r.id, parentId: r.parent_id, name: r.name, sort: r.sort ?? 0 })),
    categories: categories.data.map((c) => ({ id: c.id, parentId: c.parent_id, name: c.name, icon: c.icon, sort: c.sort ?? 0 })),
    dests: (dests.data as DestCardRow[]).map((d): DestCard => ({
      id: d.dest_id, coreType: d.core_type, slug: d.slug, regionId: d.region_id, name: d.name ?? {}, summary: d.summary,
      isDemo: d.is_demo, createdAt: d.created_at, publishedAt: d.published_at, categoryIds: d.category_ids,
      photos: d.photos.map(toPhoto),
    })),
  };
}

const t = (x: Parameters<typeof resolveLocalizedText>[0], locale: Locale) => resolveLocalizedText(x, locale).text;

// その mode の dest が使っているカテゴリだけ（親なし）
export function listCategories(catalog: Catalog, mode: Mode, locale: Locale): CategoryView[] {
  const coreTypes: readonly string[] = MODES[mode];
  const used = new Set(catalog.dests.filter((d) => coreTypes.includes(d.coreType)).flatMap((d) => d.categoryIds));
  return catalog.categories
    .filter((c) => used.has(c.id) && !c.parentId)
    .map((c) => ({ id: c.id, label: t(c.name, locale), icon: c.icon }));
}

export function listAreas(catalog: Catalog, locale: Locale): AreaGroupView[] {
  return catalog.regions
    .filter((r) => !r.parentId)
    .map((r) => ({
      id: r.id,
      label: t(r.name, locale),
      subs: catalog.regions.filter((x) => x.parentId === r.id).map((x) => ({ id: x.id, label: t(x.name, locale) })),
    }));
}

/** エリアの特性（地図の絞り込み用）。特性のマスターと土地由来の値を読み、宿・体験の分類からの特性はカタログから数える */
export async function getAreaTraits(catalog: Catalog, locale: Locale): Promise<AreaTraits> {
  const { traits, regionTraits } = await loadTraitRows();
  return areaTraitsOf(traits, regionTraits, catalog.dests, locale);
}

async function loadTraitRows(): Promise<{ traits: TraitRow[]; regionTraits: RegionTraitRow[] }> {
  "use cache";
  cacheLife("minutes");
  const db = supabase();
  const [traits, regionTraits] = await Promise.all([
    db.from("traits").select("id, name, icon, sort, source, category_ids").order("sort"),
    selectAll<RegionTraitRow>(db, "region_traits", "region_id, trait_id, value", ["region_id", "trait_id"]),
  ]);
  if (traits.error) throw new Error(`Supabase の読み込みに失敗しました: ${traits.error.message}`);
  return { traits: traits.data as TraitRow[], regionTraits };
}
