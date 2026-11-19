// 保存一覧（サーバー側）。user_saves を新しい順に読み、catalog の公開中の dest に引き当てる。
// client はサーバーの Supabase client（RLS で自分の行だけ見える）を引数で受ける。テストでは fake を渡す
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAll } from "./supabase/select-all";
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
  // 新しい順。同じ時刻の行は dest_id（主キーの片割れ）で順を決める。1000 件を超えてもページを送って読み切る
  const rows = await selectAll<{ dest_id: string }>(client, "user_saves", "dest_id, created_at", [
    { column: "created_at", ascending: false },
    { column: "dest_id", ascending: false },
  ]);
  const byId = new Map(catalog.dests.map((d) => [d.id, d]));
  const seen = new Set<string>();
  return rows.flatMap((r) => {
    const d = byId.get(r.dest_id);
    // 読んでいる間に保存が増えるとページの境目で同じ行を 2 回読むことがあるので 1 回だけ出す
    if (!d || seen.has(d.id)) return [];
    seen.add(d.id);
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
