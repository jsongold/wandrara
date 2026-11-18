// エリアの特性を、特性のマスター・土地由来の値・公開中の宿・体験の分類から組み立てる（純関数）
import type { AreaTraits } from "./area-filter";
import { resolveLocalizedText } from "./feed";
import type { Locale, LocalizedText } from "./types";

export type TraitRow = { id: string; name: LocalizedText; icon: string; sort: number | null; source: "items" | "geo"; category_ids: string[] | null };
export type RegionTraitRow = { region_id: string; trait_id: string; value: number };
type Dest = { regionId: string | null; categoryIds: string[] };

/** 特性はエリアに 1 つ以上付いたものだけ並べる（押しても何も残らない条件は出さない） */
export function areaTraitsOf(traits: TraitRow[], regionTraits: RegionTraitRow[], dests: Dest[], locale: Locale): AreaTraits {
  const byRegion = new Map<string, Set<string>>();
  const add = (region: string, trait: string) => {
    if (!byRegion.has(region)) byRegion.set(region, new Set());
    byRegion.get(region)!.add(trait);
  };
  for (const t of traits) {
    if (t.source !== "items" || !t.category_ids?.length) continue;
    const cats = new Set(t.category_ids);
    for (const d of dests) if (d.regionId && d.categoryIds.some((c) => cats.has(c))) add(d.regionId, t.id);
  }
  const geo = new Set(traits.filter((t) => t.source === "geo").map((t) => t.id));
  for (const r of regionTraits) if (geo.has(r.trait_id) && r.value > 0) add(r.region_id, r.trait_id);

  const used = new Set([...byRegion.values()].flatMap((s) => [...s]));
  return {
    traits: [...traits]
      .filter((t) => used.has(t.id))
      .sort((a, b) => (a.sort ?? 1e9) - (b.sort ?? 1e9))
      .map((t) => ({ id: t.id, label: resolveLocalizedText(t.name, locale).text, icon: t.icon })),
    byRegion: Object.fromEntries([...byRegion].map(([k, v]) => [k, [...v].sort()])),
  };
}
