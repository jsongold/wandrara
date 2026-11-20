// アプリのデータを特徴にする。特徴の出どころを知っているのはこのファイルだけ。
// 今：地区の特性（trait:）・種類（kind:）・地区（area:）。dest_traits の値ができたら destTraits に渡すだけで dest: が加わる
import { cardTraitIds, type PlanItem } from "../suggest";
import { MATCH, type KeywordSource } from "../suggest-vocab";
import type { Candidate, FeatureId } from "./types";

export type CandidateSource = PlanItem & { destId: string; title: string };

/** 候補 1 件の特徴 */
export function featuresOf(item: PlanItem, byRegion: Record<string, string[]>, destTraits: string[] = []): FeatureId[] {
  return [
    ...cardTraitIds(item.regionIds, byRegion).map((t) => `trait:${t}`),
    `kind:${item.coreType}`,
    ...(item.regionIds[0] ? [`area:${item.regionIds[0]}`] : []),
    ...destTraits.map((t) => `dest:${t}`),
  ];
}

/** 提案ページのカードを候補にする。destTraitsOf は dest_id → dest_traits の id（今は無し） */
export function toCandidates(items: CandidateSource[], byRegion: Record<string, string[]>, destTraitsOf: (destId: string) => string[] = () => []): Candidate[] {
  return items.map((c) => ({ id: c.destId, name: c.title, features: featuresOf(c, byRegion, destTraitsOf(c.destId)) }));
}

/** 条件のこだわり（キーワード id）を特徴にする。値を持たないキーワードは捨てる */
export function conditionFeatures(keywords: string[], match: Record<string, KeywordSource> = MATCH): FeatureId[] {
  return keywords.flatMap((k) => {
    const src = match[k];
    if (!src) return [];
    return ["core" in src ? `kind:${src.core}` : `trait:${src.trait}`];
  });
}

/** 特徴の名前の引き方。型ごとに名前の表を渡す（言語・出どころはここに持ち込まない） */
export type FeatureLabels = { trait: (id: string) => string | undefined; kind: (id: string) => string | undefined; area: (id: string) => string | undefined; dest?: (id: string) => string | undefined };

export function featureLabeler(labels: FeatureLabels): (f: FeatureId) => string {
  return (f) => {
    const [type, id] = [f.slice(0, f.indexOf(":")), f.slice(f.indexOf(":") + 1)];
    const lookup = labels[type as keyof FeatureLabels];
    return lookup?.(id) ?? id;
  };
}
