// おすすめの代表の場所（表紙の写真と場所の名前）。おすすめごとに slug と写真の番号を決めてあり（suggest-vocab の PRESETS）、ここで DB から引く。
// 公開・非公開で変わるので catalog tag。寿命は getCatalog と同じ（約 1 分）
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "./cache-tags";
import { env, photoUrl, supabase } from "./data";
import { resolveLocalizedText } from "./feed";
import { PRESETS, type Preset } from "./suggest-vocab";
import type { Locale, LocalizedText } from "./types";

export type PresetRow = { slug: string; name: LocalizedText | null; photos: { storage_key: string }[] };
/** cover：表紙の写真の URL（無ければ null）、places：代表の場所の名前（重複なし・見つかったものだけ） */
export type PresetView = { cover: string | null; places: string[] };

/** おすすめごとの表紙と場所の名前（純関数）。見つからない slug・写真の番号は飛ばす */
export function presetViews(presets: Preset[], rows: PresetRow[], locale: Locale, baseUrl: string): Record<string, PresetView> {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return Object.fromEntries(
    presets.map((p) => {
      const found = p.examples.map((e) => ({ e, row: bySlug.get(e.slug) })).filter((x) => x.row);
      const first = found[0];
      const photo = first ? (first.row!.photos[first.e.photo ?? 0] ?? first.row!.photos[0]) : undefined;
      const places = [...new Set(found.map((x) => resolveLocalizedText(x.row!.name, locale).text).filter(Boolean))];
      return [p.id, { cover: photo ? photoUrl(baseUrl, photo.storage_key) : null, places }];
    }),
  );
}

async function loadPresetRows(): Promise<PresetRow[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  const slugs = [...new Set(PRESETS.flatMap((p) => p.examples.map((e) => e.slug)))];
  const { data, error } = await supabase().from("dest_cards").select("slug, name, photos").in("slug", slugs);
  if (error) throw new Error(`Supabase の読み込みに失敗しました: dest_cards（おすすめ）: ${error.message}`);
  return data as PresetRow[];
}

export async function getPresetViews(locale: Locale): Promise<Record<string, PresetView>> {
  return presetViews(PRESETS, await loadPresetRows(), locale, env().url);
}
