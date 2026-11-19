// サーバーキャッシュ（use cache）の tag 名。付ける側（data.ts / detail.ts）と無効化する側（invalidate.ts）で共有する。
// 対応表は PR #103 の本文。公開状態が変わると影響するのは「公開中の一覧（CATALOG）」と「その dest の詳細（destTag）」だけ。
export const CATALOG_TAG = "catalog";
export const REGIONS_TAG = "regions";
export const TRAITS_TAG = "traits";
/** slug ごとの詳細。全言語の詳細が同じ tag を持つ（言語ごとに無効化しなくて済む） */
export const destTag = (slug: string): string => `dest:${slug}`;
