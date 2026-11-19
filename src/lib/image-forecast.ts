// 画像変換の月間件数と費用の見積もり（純粋な計算）。#125。
// 前提は docs/perf/README.md の MS1c の見積もり：写真 約 1,100 枚で月 約 3,300 件 → 1 枚あたり 3.0 件（全写真が月内に見られる上限側）。
// 料金は Vercel の公式ドキュメント（regional-pricing/hnd1、Pro、2026-11-19 に確認）。Hobby は月 5K 件まで、超えると新しい最適化が 402。

export const HOBBY_TRANSFORMS_PER_MONTH = 5_000;
export const TRANSFORMS_PER_PHOTO = 3.0;
/** hnd1 の Image Optimization（USD）。変換は 1K 件、キャッシュ書き込みは 8KB 単位で 1M 単位あたり */
export const PRICE_PER_1K_TRANSFORMS = 0.0661;
export const PRICE_PER_1M_CACHE_WRITE_UNITS = 5.2;
/** 変換後 1 枚の平均を 50KB とみなす（8KB 単位で 7 個）。実測ではなく仮定 */
export const WRITE_UNITS_PER_TRANSFORM = 7;

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
