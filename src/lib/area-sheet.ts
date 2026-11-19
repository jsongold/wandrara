// エリア選択シート（一覧・地図）に要るデータ。トップの props では送らず、シートを開いたときに /api/area-sheet から取る（MS2c #110）。
// 地域と特性のマスターだけで決まる（dest の件数に比例しない）。純関数
import type { AreaTraits } from "./area-filter";
import { resolveLocalizedText } from "./feed";
import type { AreaGroupView, Locale, Region } from "./types";

export type AreaSheetData = { areas: AreaGroupView[]; traits: AreaTraits };

const t = (x: Region["name"], locale: Locale) => resolveLocalizedText(x, locale).text;

/** 親なしのエリアと、その直下の地区 */
export function listAreas(regions: Region[], locale: Locale): AreaGroupView[] {
  const subs = new Map<string, { id: string; label: string }[]>();
  for (const r of regions) {
    if (!r.parentId) continue;
    const list = subs.get(r.parentId) ?? [];
    list.push({ id: r.id, label: t(r.name, locale) });
    subs.set(r.parentId, list);
  }
  return regions.filter((r) => !r.parentId).map((r) => ({ id: r.id, label: t(r.name, locale), subs: subs.get(r.id) ?? [] }));
}

/** 今のエリアの名前。知らない id は null（呼び出し側は「すべてのエリア」と同じに扱う） */
export function areaLabelOf(regions: Region[], id: string, locale: Locale): string | null {
  const r = id === "all" ? undefined : regions.find((x) => x.id === id);
  return r ? t(r.name, locale) : null;
}
