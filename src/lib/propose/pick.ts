// 次の候補を選ぶ：点数の高い順に、すでに選んだものと似すぎないように（MMR）。2 回目からは 1 枠をまだ見ていない種類に充てる
import { featureType, scoreOf, similarity } from "./score";
import type { Candidate, Picker } from "./types";

export type MmrConfig = { n: number; lambda: number; explore: boolean };
export const MMR_V1: MmrConfig = { n: 3, lambda: 0.5, explore: true };

const kindsOf = (features: string[]) => features.filter((f) => featureType(f) === "kind");

export function mmrPicker(cfg: MmrConfig = MMR_V1, name = "pick-mmr@1"): Picker {
  return {
    name,
    pick(pool, w, { state, featuresOf }) {
      const score = new Map(pool.map((c) => [c.id, scoreOf(c.features, w)]));
      const picked: Candidate[] = [];
      const rest = [...pool];
      while (picked.length < cfg.n && rest.length) {
        let best = 0;
        let bestValue = -Infinity;
        rest.forEach((c, i) => {
          const near = picked.length ? Math.max(...picked.map((p) => similarity(p.features, c.features))) : 0;
          const v = score.get(c.id)! - cfg.lambda * near;
          if (v > bestValue) [best, bestValue] = [i, v]; // 同点は先のもの（入力の順）
        });
        picked.push(rest.splice(best, 1)[0]);
      }
      // 探索：見せた種類しか出ていなければ、最後の 1 枠を見ていない種類の一番点の高いものに替える
      if (cfg.explore && state.round > 0 && picked.length >= 2) {
        const seen = new Set(state.shown.flatMap((id) => kindsOf(featuresOf(id))));
        if (!picked.some((c) => kindsOf(c.features).some((k) => !seen.has(k)))) {
          const fresh = rest.filter((c) => kindsOf(c.features).some((k) => !seen.has(k)));
          if (fresh.length) {
            const top = fresh.reduce((a, b) => (score.get(b.id)! > score.get(a.id)! ? b : a));
            picked[picked.length - 1] = top;
          }
        }
      }
      return picked.map((c) => c.id);
    },
  };
}
