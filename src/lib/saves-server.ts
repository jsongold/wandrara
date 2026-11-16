// 保存一覧（サーバー側）。user_saves を新しい順に読み、catalog の公開中の dest に引き当てる。
// client はサーバーの Supabase client（RLS で自分の行だけ見える）を引数で受ける。テストでは fake を渡す
import type { SupabaseClient } from "@supabase/supabase-js";
import { areaLabel, kindLabelOf, resolveLocalizedText, type Catalog } from "./feed";
import type { Locale, Photo } from "./types";

export type SavedDestView = {
  destId: string;
  title: string;
  areaLabel: string;
  kindLabel: string;
  photo: Photo | null;
  href: string;
};

/** 保存したものを保存の新しい順に返す。catalog に無いもの（非公開になったもの）は出さない。エラーは throw */
export async function getSavedDests(client: SupabaseClient, catalog: Catalog, locale: Locale): Promise<SavedDestView[]> {
  const { data, error } = await client
    .from("user_saves")
    .select("dest_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const byId = new Map(catalog.dests.map((d) => [d.id, d]));
  return ((data ?? []) as { dest_id: string }[]).flatMap((r) => {
    const d = byId.get(r.dest_id);
    if (!d) return [];
    return [{
      destId: d.id,
      title: resolveLocalizedText(d.name, locale).text,
      areaLabel: areaLabel(d.regionId, catalog.regions, locale),
      kindLabel: kindLabelOf(d.coreType, locale),
      photo: d.photos[0] ?? null,
      href: `/${locale}/d/${d.slug}`,
    }];
  });
}
