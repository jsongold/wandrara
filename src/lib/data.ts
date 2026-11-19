// Supabase からコンテンツを読む。誰にでも同じ内容なので 'use cache' でまとめて持つ。
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, REGIONS_TAG, TRAITS_TAG } from "./cache-tags";
import { areaTraitsOf, type ItemTraits, type RegionTraitRow, type TraitRow } from "./area-traits";
import { listAreas, type AreaSheetData } from "./area-sheet";
import { resolveLocalizedText, type Catalog } from "./feed";
import { selectAll, TooManyRowsError } from "./supabase/select-all";
import { MODES } from "./modes";
import type { CategoryView, DestCard, Locale, LocalizedText, Mode, Photo, Region } from "./types";

export function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が未設定です");
  return { url, key };
}

export function supabase() {
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

// 地域だけ。詳細が地域名の解決に使う（全件の Catalog を読まずに済む）。getCatalog もこれを使うので読み込みは共有される
// 地域の更新は migration だけ（アプリからの無効化は無い）ので、ここはインスタンス内のキャッシュ。長く持つ
export async function getRegions(): Promise<Region[]> {
  "use cache";
  cacheTag(REGIONS_TAG);
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  // regions は 1000 行を超える（Data API は黙って切る）のでページを送って読み切る
  const rows = await selectAll<{ id: string; parent_id: string | null; name: LocalizedText; sort: number | null }>(
    supabase(), "regions", "id, parent_id, name, sort", ["sort", "id"],
  );
  return rows.map((r) => ({ id: r.id, parentId: r.parent_id, name: r.name, sort: r.sort ?? 0 }));
}

// 公開・非公開・投入で変わる。tag（catalog）を付け、更新経路が捨てる。ただしインスタンス内のキャッシュ（use cache）なので、
// 捨てられるのは書き込みを受けたインスタンスだけ。ほかのインスタンスは revalidate で追いつく。
// 寿命は main と同じ "minutes" 相当（stale 300 / revalidate 60 / expire 3600。同梱の cacheLife.md の表）を明示する。
// Catalog は日々増えるので全件キャッシュを長くしない。remote にしないのは 2MB の上限・読み取り課金が危ないため。
// MS2c の後の用途は、戦略を環境変数で差し替えたときの buildFeed の全件版（page.tsx の firstPage）だけ。通常の経路（トップ・保存一覧・詳細）は読まない。
// 件数が CATALOG_MAX_DESTS を超えたら読まずに CatalogTooLargeError（呼び出し側は DB 版に戻す）。メモリ・RSC が件数に比例するのを止める最後の歯止め
export const CATALOG_MAX_DESTS = 3000;
export class CatalogTooLargeError extends Error {
  constructor() {
    super(`dest が ${CATALOG_MAX_DESTS} 件を超えたので全件の Catalog は作らない`);
  }
}

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  // regions は中の getRegions と同じ内容。外側にも付けておく（入れ子の tag が外へ伝わるとは文書に無い）
  cacheTag(CATALOG_TAG, REGIONS_TAG);
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  const { url } = env();
  const db = supabase();
  const [regions, categories, dests] = await Promise.all([
    getRegions().then((data) => ({ data, error: null }), (e: Error) => ({ data: null, error: e })),
    db.from("categories").select("id, parent_id, name, icon, sort").order("sort"),
    // dest_cards も 1000 件で黙って切られるのでページを送って読み切る（dest_id は一意）
    selectAll<DestCardRow>(
      db, "dest_cards", "dest_id, core_type, slug, is_demo, created_at, published_at, region_id, name, summary, category_ids, photos", ["dest_id"], CATALOG_MAX_DESTS,
    ).then((data) => ({ data, error: null }), (e: Error) => ({ data: null, error: e })),
  ]);
  if (dests.error instanceof TooManyRowsError) throw new CatalogTooLargeError();
  if (regions.error || categories.error || dests.error) {
    const err = regions.error ?? categories.error ?? dests.error;
    throw new Error(`Supabase の読み込みに失敗しました: ${err?.message}`);
  }
  const toPhoto = (p: PhotoRow): Photo => ({
    url: photoUrl(url, p.storage_key), license: p.license, credit: p.credit, isDemo: false, placeholderSky: null, placeholderLand: null,
  });
  return {
    regions: regions.data!,
    categories: categories.data.map((c) => ({ id: c.id, parentId: c.parent_id, name: c.name, icon: c.icon, sort: c.sort ?? 0 })),
    dests: dests.data!.map((d): DestCard => ({
      id: d.dest_id, coreType: d.core_type, slug: d.slug, regionId: d.region_id, name: d.name ?? {}, summary: d.summary,
      isDemo: d.is_demo, createdAt: d.created_at, publishedAt: d.published_at, categoryIds: d.category_ids,
      photos: d.photos.map(toPhoto),
    })),
  };
}

const t = (x: Parameters<typeof resolveLocalizedText>[0], locale: Locale) => resolveLocalizedText(x, locale).text;

type CategoryRow = { id: string; name: LocalizedText; icon: string };

// その mode の公開中の dest が直接使っている、親なしのカテゴリ。使っているかは DB が数える（used_root_categories）ので、結果は件数ではなくカテゴリのマスターの大きさ。
// 公開・非公開で変わるので catalog tag。寿命は getCatalog と同じ（約 1 分）
async function loadModeCategories(mode: Mode): Promise<CategoryRow[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  const db = supabase();
  const [cats, used] = await Promise.all([
    db.from("categories").select("id, name, icon").is("parent_id", null).order("sort").order("id"),
    db.rpc("used_root_categories", { p_core_types: [...MODES[mode]] }),
  ]);
  if (cats.error) throw new Error(`Supabase の読み込みに失敗しました: ${cats.error.message}`);
  if (used.error) throw new Error(`Supabase の読み込みに失敗しました: used_root_categories: ${used.error.message}`);
  const ids = new Set(used.data as string[]);
  return (cats.data as CategoryRow[]).filter((c) => ids.has(c.id));
}

export async function listCategories(mode: Mode, locale: Locale): Promise<CategoryView[]> {
  return (await loadModeCategories(mode)).map((c) => ({ id: c.id, label: t(c.name, locale), icon: c.icon }));
}

// 宿・体験の分類から付く特性（エリア → 特性 id）。DB が集計する（area_item_traits）ので、結果の大きさは地域×特性のマスターで決まる。公開・非公開で変わるので catalog tag
async function loadItemTraits(): Promise<ItemTraits> {
  "use cache";
  cacheTag(CATALOG_TAG, TRAITS_TAG);
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  const { data, error } = await supabase().rpc("area_item_traits");
  if (error) throw new Error(`Supabase の読み込みに失敗しました: area_item_traits: ${error.message}`);
  return data as ItemTraits;
}

/** エリア選択シート（一覧・地図）のデータ。トップの props には載せず、シートを開いたときに /api/area-sheet が返す */
export async function getAreaSheetData(locale: Locale): Promise<AreaSheetData> {
  const [regions, rows, items] = await Promise.all([getRegions(), loadTraitRows(), loadItemTraits()]);
  return { areas: listAreas(regions, locale), traits: areaTraitsOf(rows.traits, rows.regionTraits, items, locale) };
}

// 特性のマスターと土地由来の値。更新は migration・スクリプトだけで、公開状態には依存しない
async function loadTraitRows(): Promise<{ traits: TraitRow[]; regionTraits: RegionTraitRow[] }> {
  "use cache";
  cacheTag(TRAITS_TAG);
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  const db = supabase();
  const [traits, regionTraits] = await Promise.all([
    db.from("traits").select("id, name, icon, sort, source, category_ids").order("sort"),
    selectAll<RegionTraitRow>(db, "region_traits", "region_id, trait_id, value", ["region_id", "trait_id"]),
  ]);
  if (traits.error) throw new Error(`Supabase の読み込みに失敗しました: ${traits.error.message}`);
  return { traits: traits.data as TraitRow[], regionTraits };
}
