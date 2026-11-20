// 提案の評価の指標（純関数）。決まった条件の組で提案ルームを動かした結果から、機械的に測れるものを出す。
// 合っているか・理由が本当か・捨てた条件・プランの地理（1 泊で回れるか）・候補の数・偏り・プランまでの回の数
import type { Candidate, FeatureId } from "./propose";
import type { Simulation } from "./propose/simulate";

export type EvalInput = {
  picked: string[];
  conditions: FeatureId[];
  candidates: Candidate[];
  sim: Simulation;
  /** dest_id → 座標（無ければ地理は測らない） */
  coords: Record<string, { lat: number; lng: number }>;
};

export type EvalMetrics = {
  pool: number;
  shown: number;
  /** 選んだこだわりのうち、値が無くて捨てたもの */
  dropped: string[];
  /** 出したもののうち、条件の特徴を 1 つ以上持つ割合（地区の特性も含む） */
  fit: number | null;
  /** 出したもののうち、場所そのものの特徴（dest_traits・種類）で条件に合う割合 */
  placeFit: number | null;
  /** 「〜に合う」の理由のうち、場所そのものの特徴にもとづく割合（残りは地区の特性） */
  reasonTruth: number | null;
  /** 出したものの地区の数 ÷ 出した数 */
  variety: number | null;
  roundsToPlan: number | null;
  /** プランの宿から、ほかの場所までの一番遠い距離（km） */
  planMaxKm: number | null;
};

const PLACE_LEVEL = (f: FeatureId) => f.startsWith("dest:") || f.startsWith("kind:");
const ratio = (n: number, d: number) => (d ? Math.round((n / d) * 100) / 100 : null);

/** 2 点間の距離（km、球面） */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export function evaluate(x: EvalInput, keywordFeatures: (keyword: string) => FeatureId[]): EvalMetrics {
  const byId = new Map(x.candidates.map((c) => [c.id, c]));
  const shown = x.sim.rounds.flatMap((r) => r.ids).map((id) => byId.get(id)!).filter(Boolean);
  const cond = new Set(x.conditions);
  const matched = shown.map((c) => c.features.filter((f) => cond.has(f)));
  const reasons = matched.flat();
  const plan = x.sim.goal?.stay ? [x.sim.goal.stay, ...x.sim.goal.activities] : [];
  const stay = plan.length ? x.coords[plan[0]] : undefined;
  const dists = stay ? plan.slice(1).map((id) => x.coords[id]).filter(Boolean).map((p) => km(stay, p)) : [];
  return {
    pool: x.candidates.length,
    shown: shown.length,
    dropped: x.picked.filter((k) => keywordFeatures(k).length === 0),
    fit: ratio(matched.filter((m) => m.length).length, shown.length),
    placeFit: ratio(matched.filter((m) => m.some(PLACE_LEVEL)).length, shown.length),
    reasonTruth: ratio(reasons.filter(PLACE_LEVEL).length, reasons.length),
    variety: ratio(new Set(shown.map((c) => c.features.find((f) => f.startsWith("area:")))).size, shown.length),
    roundsToPlan: x.sim.roundsToPlan,
    planMaxKm: dists.length ? Math.max(...dists) : null,
  };
}
