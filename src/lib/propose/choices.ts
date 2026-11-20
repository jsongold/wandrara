// 次の選択肢：まだ出していない候補を一番よく分ける特徴（持つ割合が 0.5 に近いもの）を選ぶ
import { featureType, splitEntropy } from "./score";
import type { Choice, Chooser, FeatureId } from "./types";

export type EntropyConfig = { max: number; minSplit: number; maxSplit: number; perType: number };
export const ENTROPY_V1: EntropyConfig = { max: 4, minSplit: 0.1, maxSplit: 0.9, perType: 2 };

/**
 * 外すもの：分けられない（割合が minSplit 未満か maxSplit より大きい）・すでに条件にある・すでに選んだ・好みがマイナス
 * 同じ型（kind・trait・area…）は perType 個まで（偏らないように）
 */
export function entropyChooser(cfg: EntropyConfig = ENTROPY_V1, name = "choices-entropy@1"): Chooser {
  return {
    name,
    choose(pool, w, { state }) {
      if (!pool.length) return [];
      const count = new Map<FeatureId, number>();
      for (const c of pool) for (const f of new Set(c.features)) count.set(f, (count.get(f) ?? 0) + 1);
      const used = new Set([...state.conditions, ...state.choices.map((c) => c.feature)]);
      const ranked = [...count]
        .map(([feature, n], i) => ({ feature, split: n / pool.length, i }))
        .filter((x) => x.split >= cfg.minSplit && x.split <= cfg.maxSplit && !used.has(x.feature) && (w.get(x.feature) ?? 0) >= 0)
        .sort((a, b) => splitEntropy(b.split) - splitEntropy(a.split) || a.i - b.i);
      const perType = new Map<string, number>();
      const out: Choice[] = [];
      for (const x of ranked) {
        const t = featureType(x.feature);
        if ((perType.get(t) ?? 0) >= cfg.perType) continue;
        perType.set(t, (perType.get(t) ?? 0) + 1);
        out.push({ feature: x.feature, split: x.split });
        if (out.length >= cfg.max) break;
      }
      return out;
    },
  };
}
