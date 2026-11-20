// 好みの重み：条件・リアクション・選んだ選択肢を、特徴ごとの重みにする
import type { Reaction } from "../reactions";
import type { FeatureId, Preference } from "./types";

export type PreferenceConfig = { condition: number; reaction: Record<Reaction, number>; choice: number; decay: number };

export const PREFERENCE_V1: PreferenceConfig = { condition: 1, reaction: { great: 2, good: 1, hmm: -1.5 }, choice: 2, decay: 0.7 };

/**
 * - 条件のこだわり：その特徴に condition
 * - リアクション：その場所の特徴に、重みを特徴の数で割って配る（特徴の多い場所が独り占めしないように）
 * - 選択肢：choice を、選んでから進んだ回の数だけ decay 倍に弱める（最近の意思を優先）
 */
export function additivePreference(cfg: PreferenceConfig = PREFERENCE_V1, name = "pref-additive@1"): Preference {
  return {
    name,
    weigh({ state, featuresOf }) {
      const w = new Map<FeatureId, number>();
      const add = (f: FeatureId, v: number) => w.set(f, (w.get(f) ?? 0) + v);
      for (const f of state.conditions) add(f, cfg.condition);
      for (const [id, r] of Object.entries(state.reactions)) {
        const fs = featuresOf(id);
        for (const f of fs) add(f, cfg.reaction[r] / fs.length);
      }
      for (const c of state.choices) add(c.feature, cfg.choice * cfg.decay ** Math.max(0, state.round - c.round));
      return w;
    },
  };
}
