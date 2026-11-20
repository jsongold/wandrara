// 提案ルーム（/[lang]/plan）に渡すデータを作る（純関数）。
// 画面のカードと、提案エンジンの候補・条件・特徴の名前を、同じカードの並びから作る
import { conditionFeatures, featureLabeler, toCandidates, type Candidate, type FeatureId } from "./propose";
import type { AreaTraits } from "./area-filter";
import type { AreaGroupView, FeedCard } from "./types";

// reason：このカードに当てはまった、選んだこだわりの名前（無ければ空）
export type PlanCard = FeedCard & { reason: string[] };

export type RoomData = {
  cards: PlanCard[];
  candidates: Candidate[];
  conditions: FeatureId[];
  /** 候補に出てくる特徴 → 名前（選択肢・一言に使う） */
  labels: Record<FeatureId, string>;
};

export function roomData(cards: PlanCard[], picked: string[], traits: AreaTraits, areas: AreaGroupView[], destTraitsOf?: (destId: string) => string[]): RoomData {
  const candidates = toCandidates(
    cards.map((c) => ({ destId: c.destId, title: c.title, regionIds: c.regionIds, coreType: c.coreType })),
    traits.byRegion,
    destTraitsOf,
  );
  const traitLabel = new Map(traits.traits.map((t) => [t.id, t.label]));
  const kindLabel = new Map(cards.map((c) => [c.coreType, c.kindLabel]));
  const areaLabel = new Map(areas.flatMap((g) => [[g.id, g.label] as const, ...g.subs.map((s) => [s.id, s.label] as const)]));
  const labelOf = featureLabeler({ trait: (id) => traitLabel.get(id), kind: (id) => kindLabel.get(id), area: (id) => areaLabel.get(id) });
  const labels = Object.fromEntries([...new Set(candidates.flatMap((c) => c.features))].map((f) => [f, labelOf(f)]));
  return { cards, candidates, conditions: conditionFeatures(picked), labels };
}
