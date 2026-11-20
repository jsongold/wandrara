// 提案ルーム（/[lang]/plan）に渡すデータを作る（純関数）。
// 画面のカードと、提案エンジンの候補・条件・特徴の名前を、同じカードの並びから作る
import { keywordOf, MATCH } from "./suggest-vocab";
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

/**
 * cards：エリアで絞ったカード（reason は空でよい。ここで条件と特徴から付け直す）
 * destTraits：dest_id → dest_traits の特徴 id（無ければ地区の特性と種類だけ）
 */
export function roomData(cards: FeedCard[], picked: string[], traits: AreaTraits, areas: AreaGroupView[], destTraits: Record<string, string[]> = {}): RoomData {
  const candidates = toCandidates(
    cards.map((c) => ({ destId: c.destId, title: c.title, regionIds: c.regionIds, coreType: c.coreType })),
    traits.byRegion,
    (id) => destTraits[id] ?? [],
  );
  const traitLabel = new Map(traits.traits.map((t) => [t.id, t.label]));
  const kindLabel = new Map(cards.map((c) => [c.coreType, c.kindLabel]));
  const areaLabel = new Map(areas.flatMap((g) => [[g.id, g.label] as const, ...g.subs.map((s) => [s.id, s.label] as const)]));
  const labelOf = featureLabeler({ trait: (id) => traitLabel.get(id), kind: (id) => kindLabel.get(id), area: (id) => areaLabel.get(id), dest: (id) => keywordOf(id)?.label });
  const destTraitIds = new Set(Object.values(destTraits).flat());
  const conditions = conditionFeatures(picked, MATCH, destTraitIds);
  // 条件の名前：選んだキーワードの名前（特徴の名前より、選んだときの言葉を優先する）
  const conditionLabel = new Map(picked.flatMap((k) => conditionFeatures([k], MATCH, destTraitIds).map((f) => [f, keywordOf(k)?.label ?? labelOf(f)] as const)));
  const labels: Record<FeatureId, string> = Object.fromEntries([...new Set(candidates.flatMap((c) => c.features))].map((f) => [f, conditionLabel.get(f) ?? labelOf(f)]));
  const byId = new Map(candidates.map((c) => [c.id, new Set(c.features)]));
  const withReason: PlanCard[] = cards.map((c) => ({ ...c, reason: conditions.filter((f) => byId.get(c.destId)?.has(f)).map((f) => labels[f] ?? labelOf(f)) }));
  return { cards: withReason, candidates, conditions, labels };
}
