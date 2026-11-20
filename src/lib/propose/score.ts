// 特徴の集合どうしの計算（点数・近さ・分け方の良さ）。どの戦略からも使う
import type { FeatureId, Weights } from "./types";

/** 候補の点数：持っている特徴の重みの合計 */
export const scoreOf = (features: FeatureId[], w: Weights): number => features.reduce((s, f) => s + (w.get(f) ?? 0), 0);

/** 近さ（Jaccard）：重なった特徴の数 ÷ どちらかが持つ特徴の数 */
export function similarity(a: FeatureId[], b: FeatureId[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const union = new Set([...A, ...B]).size;
  if (union === 0) return 0;
  let both = 0;
  for (const f of A) if (B.has(f)) both++;
  return both / union;
}

/** 分け方の良さ（2 値のエントロピー）。p が 0.5 で 1、0 か 1 で 0 */
export function splitEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}

/** 特徴の型（"kind:village" → "kind"） */
export const featureType = (f: FeatureId): string => f.split(":", 1)[0];
