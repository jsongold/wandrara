// 画像変換の月間件数と費用の見積もり（純粋な計算）。#125。
// 前提は docs/perf/README.md の MS1c の見積もり：写真 約 1,100 枚で月 約 3,300 件 → 1 枚あたり 3.0 件（全写真が月内に見られる上限側。形式は WebP のみ）。
// #151：形式に AVIF を足した。キーは 画像 × 幅 × 画質 × 形式 なので、AVIF 対応の端末は 3.0 件のまま AVIF で、AVIF 非対応の端末・クローラーが見る分だけ WebP が別に 1 件ずつ増える。
// 料金は Vercel の公式ドキュメント（regional-pricing/hnd1、Pro、2026-11-19 に確認）。Hobby は月 5K 件まで、超えると新しい最適化が 402。

export const HOBBY_TRANSFORMS_PER_MONTH = 5_000;
/** AVIF 対応の端末が見たときの 1 枚あたりの件数（幅 2 種類 × 端末 2 クラスの上限側。MS1c） */
export const AVIF_TRANSFORMS_PER_PHOTO = 3.0;
/** AVIF 非対応の端末・クローラーが、同じ写真（幅）の WebP も別に取る割合。実測ではなく仮定（Hobby の上限側に置く） */
export const WEBP_FALLBACK_SHARE = 0.1;
export const TRANSFORMS_PER_PHOTO = Math.round(AVIF_TRANSFORMS_PER_PHOTO * (1 + WEBP_FALLBACK_SHARE) * 100) / 100;
/** hnd1 の Image Optimization（USD）。変換は 1K 件、キャッシュ書き込みは 8KB 単位で 1M 単位あたり */
export const PRICE_PER_1K_TRANSFORMS = 0.0661;
export const PRICE_PER_1M_CACHE_WRITE_UNITS = 5.2;
/** 変換後 1 枚の平均を 25KB とみなす（8KB 単位で 4 個）。AVIF q75 の実測：カルーセル 828 が平均 22KB・タイル 384 が 7KB（#151）。WebP は約 1.7 倍だが割合が小さいので 4 のまま */
export const WRITE_UNITS_PER_TRANSFORM = 4;

export type Forecast = {
  photos: number;
  transforms: number;
  hobbyShare: number;
  overHobby: boolean;
  proUsd: number;
};

export function forecast(photos: number, perPhoto = TRANSFORMS_PER_PHOTO): Forecast {
  const transforms = Math.round(photos * perPhoto);
  const proUsd =
    (transforms / 1000) * PRICE_PER_1K_TRANSFORMS +
    ((transforms * WRITE_UNITS_PER_TRANSFORM) / 1_000_000) * PRICE_PER_1M_CACHE_WRITE_UNITS;
  return { photos, transforms, hobbyShare: transforms / HOBBY_TRANSFORMS_PER_MONTH, overHobby: transforms > HOBBY_TRANSFORMS_PER_MONTH, proUsd };
}

/** Hobby の上限に当たる写真の枚数 */
export function hobbyLimitPhotos(perPhoto = TRANSFORMS_PER_PHOTO): number {
  return Math.floor(HOBBY_TRANSFORMS_PER_MONTH / perPhoto);
}
