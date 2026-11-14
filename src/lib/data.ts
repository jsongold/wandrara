// Supabase からコンテンツを読む。誰にでも同じ内容なので 'use cache' でまとめて持つ。
import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { areaLabel, resolveLocalizedText, type Catalog } from "./feed";
import type { AreaGroupView, CategoryView, Fact, Locale, Mode, Photo, Spot, SpotDetailView } from "./types";

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が未設定です");
  return createClient(url, key, { auth: { persistSession: false } });
}

type PhotoRow = { url: string | null; license: string | null; credit: string | null; is_demo: boolean; placeholder_sky: string | null; placeholder_land: string | null; sort: number };

const toPhoto = (p: PhotoRow): Photo => ({
  url: p.url, license: p.license, credit: p.credit, isDemo: p.is_demo, placeholderSky: p.placeholder_sky, placeholderLand: p.placeholder_land,
});

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("minutes");
  const db = supabase();
  const [areas, categories, spots] = await Promise.all([
    db.from("areas").select("id, parent_id, name, sort").order("sort"),
    db.from("categories").select("id, mode, parent_id, name, icon, sort").order("sort"),
    db.from("spots").select("id, kind, area_id, name, summary, editorial_rank, is_demo, created_at, spot_categories(category_id), spot_photos(url, license, credit, is_demo, placeholder_sky, placeholder_land, sort)"),
  ]);
  if (areas.error || categories.error || spots.error) {
    const err = areas.error ?? categories.error ?? spots.error;
    throw new Error(`Supabase の読み込みに失敗しました: ${err?.message}`);
  }
  return {
    areas: areas.data.map((a) => ({ id: a.id, parentId: a.parent_id, name: a.name, sort: a.sort })),
    categories: categories.data.map((c) => ({ id: c.id, mode: c.mode, parentId: c.parent_id, name: c.name, icon: c.icon, sort: c.sort })),
    spots: spots.data.map((s): Spot => ({
      id: s.id, kind: s.kind, areaId: s.area_id, name: s.name, summary: s.summary, editorialRank: s.editorial_rank, isDemo: s.is_demo, createdAt: s.created_at,
      categoryIds: (s.spot_categories as { category_id: string }[]).map((x) => x.category_id),
      photos: [...(s.spot_photos as PhotoRow[])].sort((a, b) => a.sort - b.sort).map(toPhoto),
    })),
  };
}

const t = (x: Parameters<typeof resolveLocalizedText>[0], locale: Locale) => resolveLocalizedText(x, locale).text;

export function listCategories(catalog: Catalog, mode: Mode, locale: Locale): CategoryView[] {
  return catalog.categories.filter((c) => c.mode === mode && !c.parentId).map((c) => ({ id: c.id, label: t(c.name, locale), icon: c.icon }));
}

export function listAreas(catalog: Catalog, locale: Locale): AreaGroupView[] {
  return catalog.areas
    .filter((a) => !a.parentId)
    .map((r) => ({
      id: r.id,
      label: t(r.name, locale),
      subs: catalog.areas.filter((a) => a.parentId === r.id).map((a) => ({ id: a.id, label: t(a.name, locale) })),
    }));
}

const KIND_LABEL: Record<Spot["kind"], string> = { stay: "宿", place: "スポット", experience: "体験" };

export async function getSpotDetail(id: string, locale: Locale): Promise<SpotDetailView | null> {
  "use cache";
  cacheLife("minutes");
  const catalog = await getCatalog();
  const spot = catalog.spots.find((s) => s.id === id);
  if (!spot) return null;
  const { data, error } = await supabase()
    .from("spot_facts")
    .select("key, label, value, status, source_name, source_url, checked_at, detail, sort")
    .eq("spot_id", id)
    .order("sort");
  if (error) throw new Error(`Supabase の読み込みに失敗しました: ${error.message}`);
  const facts: Fact[] = data.map((f) => ({
    key: f.key, label: f.label, value: f.value, status: f.status, sourceName: f.source_name, sourceUrl: f.source_url, checkedAt: f.checked_at, detail: f.detail, sort: f.sort,
  }));
  const cats = catalog.categories.filter((c) => spot.categoryIds.includes(c.id));
  return {
    id: spot.id,
    title: t(spot.name, locale),
    areaLabel: areaLabel(spot.areaId, catalog.areas, locale),
    kindLabel: cats.find((c) => c.mode === "place")?.name ? t(cats.find((c) => c.mode === "place")!.name, locale) : KIND_LABEL[spot.kind],
    summary: spot.summary ? t(spot.summary, locale) : null,
    isDemo: spot.isDemo,
    photos: spot.photos,
    facts: facts.map((f) => ({
      key: f.key,
      label: t(f.label, locale),
      value: f.value ? t(f.value, locale) : null,
      status: f.status,
      sourceName: f.sourceName,
      sourceUrl: f.sourceUrl,
      checkedAt: f.checkedAt,
      detail: f.detail ? t(f.detail, locale) : null,
    })),
  };
}
