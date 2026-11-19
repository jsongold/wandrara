// 保存一覧（サーバー側）。user_saves を新しい順に読み、保存した dest だけを dest_cards から引く（MS2c #110。公開中の dest 全件は読まない）。
// client はサーバーの Supabase client（RLS で自分の行だけ見える）を引数で受ける。テストでは fake を渡す
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAll } from "./supabase/select-all";
import { areaLabel, kindLabelOf, resolveLocalizedText } from "./feed";
import type { Locale, LocalizedText, Photo, Region } from "./types";

export type SavedDestView = {
  destId: string;
  title: string;
  areaLabel: string;
  kindLabel: string;
  photo: Photo | null;
  href: string;
};

type CardRow = {
  dest_id: string;
  core_type: string;
  slug: string;
  region_id: string | null;
  name: LocalizedText | null;
  photo: { storage_key: string; license: string | null; credit: string | null } | null; // photos の先頭 1 枚（photos->0）。一覧は 1 枚しか使わない
};

// 1 回の URL に載せる id の数（uuid 36 文字 × 100 で約 4KB）と、同時に出す取得の数
const ID_CHUNK = 100;
const PARALLEL = 4;

// 保存した dest の行。公開されていない（非公開になった）ものは返らない。取得の回数は保存の数に比例する（利用者の保存の数であって、dest の総数ではない）
async function fetchCards(client: SupabaseClient, ids: string[]): Promise<Map<string, CardRow>> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK));
  const out = new Map<string, CardRow>();
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    await Promise.all(
      chunks.slice(i, i + PARALLEL).map(async (chunk) => {
        const { data, error } = await client.from("dest_cards").select("dest_id, core_type, slug, region_id, name, photo:photos->0").in("dest_id", chunk);
        if (error) throw new Error(`dest_cards: ${error.message}`);
        for (const r of (data ?? []) as unknown as CardRow[]) out.set(r.dest_id, r);
      }),
    );
  }
  return out;
}

/** 保存したものを保存の新しい順に返す。公開中でなくなったものは出さない。エラーは throw。photoBase は Storage の公開 URL の頭（photoUrl の第 1 引数） */
export async function getSavedDests(
  client: SupabaseClient,
  ctx: { regions: Region[]; photoBase: (storageKey: string) => string },
  locale: Locale,
): Promise<SavedDestView[]> {
  // 新しい順。同じ時刻の行は dest_id（主キーの片割れ）で順を決める。1000 件を超えてもページを送って読み切る
  const rows = await selectAll<{ dest_id: string }>(client, "user_saves", "dest_id, created_at", [
    { column: "created_at", ascending: false },
    { column: "dest_id", ascending: false },
  ]);
  const ids = [...new Set(rows.map((r) => r.dest_id))]; // 読んでいる間に保存が増えるとページの境目で同じ行を 2 回読むことがあるので 1 回だけ
  const cards = await fetchCards(client, ids);
  return ids.flatMap((id) => {
    const d = cards.get(id);
    if (!d) return [];
    return [{
      destId: d.dest_id,
      title: resolveLocalizedText(d.name ?? {}, locale).text,
      areaLabel: areaLabel(d.region_id, ctx.regions, locale),
      kindLabel: kindLabelOf(d.core_type, locale),
      photo: d.photo
        ? { url: ctx.photoBase(d.photo.storage_key), license: d.photo.license, credit: d.photo.credit, isDemo: false, placeholderSky: null, placeholderLand: null }
        : null,
      href: `/${locale}/d/${d.slug}`,
    }];
  });
}
