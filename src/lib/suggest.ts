// 提案（全画面フィード）：選んだ条件（エリアの特性）で、まだ見ていない先のカードを並べ替える。絞り込みではないので件数は減らさない（純関数）
import type { TraitView } from "./area-filter";

/**
 * カードの条件：カードの地区（regionIds の先頭）に付いた特性 id。地区に無ければ親を見る。
 * 親（箱根・伊豆など）はほぼ全部の特性を持つので、合わせると全カードが合ってしまう。今後は dest が持つ条件の表に替える
 */
export function cardTraitIds(regionIds: string[], byRegion: Record<string, string[]>): string[] {
  for (const r of regionIds) {
    const ids = byRegion[r] ?? [];
    if (ids.length) return [...new Set(ids)];
  }
  return [];
}

/**
 * pivot までのカード（見たもの・今のもの）は動かさず、その先を選んだ条件に合う数の多い順に並べる（同じ数は元の順）。
 * pivot が -1 なら全部を並べ替える
 */
export function orderBySuggest<T>(cards: T[], pivot: number, picked: string[], traitsOf: (c: T) => string[]): T[] {
  if (picked.length === 0) return cards;
  const fixed = cards.slice(0, pivot + 1);
  const rest = cards
    .slice(pivot + 1)
    .map((c, n) => ({ c, n, s: traitsOf(c).filter((t) => picked.includes(t)).length }))
    .sort((a, b) => b.s - a.s || a.n - b.n)
    .map((x) => x.c);
  return [...fixed, ...rest];
}

export type SuggestReason = { kind: "match" | "trait"; traits: TraitView[] };

/** カードを出した理由：選んだ条件に合えばそれ、無ければカードの特性の先頭。何も無ければ null */
export function suggestReason(cardTraits: string[], picked: string[], traits: TraitView[]): SuggestReason | null {
  const byId = new Map(traits.map((t) => [t.id, t]));
  const hit = picked.filter((id) => cardTraits.includes(id)).flatMap((id) => byId.get(id) ?? []);
  if (hit.length) return { kind: "match", traits: hit };
  const own = traits.find((t) => cardTraits.includes(t.id));
  return own ? { kind: "trait", traits: [own] } : null;
}

// ---- 提案ページの URL（/[lang]/plan?t=onsen,hike） ----

const TRAIT_ID = /^[a-z0-9-]{1,40}$/;
const MAX_TRAITS = 10;

/** ?t= を条件の id にする。形の違うもの・重複は捨てる */
export function parseSuggestTraits(raw: string | string[] | undefined): string[] {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return [...new Set((v ?? "").split(",").filter((x) => TRAIT_ID.test(x)))].slice(0, MAX_TRAITS);
}

export function suggestPlanHref(locale: string, picked: string[]): string {
  return picked.length ? `/${locale}/plan?t=${picked.map(encodeURIComponent).join(",")}` : `/${locale}/plan`;
}
