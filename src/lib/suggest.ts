// 提案：選んだこだわり（キーワード）で並べ替え、エリアで絞る（純関数）。
// キーワードの値は今はエリアの特性と dest の種類（suggest-vocab の MATCH）。dest_traits ができたら matchedKeywords の中身だけ替える
import { MATCH, type KeywordSource } from "./suggest-vocab";

/** 判定に要るカードの情報（提案ページのカードとシートの件数で同じものを使う） */
export type PlanItem = { regionIds: string[]; coreType: string };

/**
 * カードの特性：カードの地区（regionIds の先頭）に付いた特性 id。地区に無ければ親を見る。
 * 親（箱根・伊豆など）はほぼ全部の特性を持つので、合わせると全カードが合ってしまう
 */
export function cardTraitIds(regionIds: string[], byRegion: Record<string, string[]>): string[] {
  for (const r of regionIds) {
    const ids = byRegion[r] ?? [];
    if (ids.length) return [...new Set(ids)];
  }
  return [];
}

/** 値を持つキーワードか（持たないものは件数・並べ替えに使わない） */
export const hasData = (keyword: string, match: Record<string, KeywordSource> = MATCH): boolean => keyword in match;

/** カードに当てはまるキーワード（値を持つものだけ） */
export function matchedKeywords(item: PlanItem, keywords: string[], byRegion: Record<string, string[]>, match: Record<string, KeywordSource> = MATCH): string[] {
  let traits: string[] | null = null;
  return keywords.filter((k) => {
    const src = match[k];
    if (!src) return false;
    if ("core" in src) return item.coreType === src.core;
    traits ??= cardTraitIds(item.regionIds, byRegion);
    return traits.includes(src.trait);
  });
}

/** エリアの絞り込み（これまでどおり）。all は全部 */
export const inArea = (item: PlanItem, area: string): boolean => area === "all" || item.regionIds.includes(area);

/** エリアの中で、値を持つキーワードをすべて満たすカードの数（先に出る件数） */
export function countMatching(items: PlanItem[], keywords: string[], area: string, byRegion: Record<string, string[]>, match: Record<string, KeywordSource> = MATCH): number {
  const live = keywords.filter((k) => k in match);
  return items.filter((it) => inArea(it, area) && matchedKeywords(it, live, byRegion, match).length === live.length).length;
}

/**
 * pivot までのカード（見たもの・今のもの）は動かさず、その先を選んだ条件に合う数の多い順に並べる（同じ数は元の順）。
 * pivot が -1 なら全部を並べ替える
 */
export function orderBySuggest<T>(cards: T[], pivot: number, picked: string[], keysOf: (c: T) => string[]): T[] {
  if (picked.length === 0) return cards;
  const fixed = cards.slice(0, pivot + 1);
  const rest = cards
    .slice(pivot + 1)
    .map((c, n) => ({ c, n, s: keysOf(c).filter((t) => picked.includes(t)).length }))
    .sort((a, b) => b.s - a.s || a.n - b.n)
    .map((x) => x.c);
  return [...fixed, ...rest];
}

// ---- 提案ページの URL（/[lang]/plan?t=near_lake,plateau&area=hakone） ----

const KEY = /^[a-z0-9_-]{1,40}$/;
/** 選べるキーワードの上限。シートもこの数を超えて足さない（URL で黙って捨てないため） */
export const MAX_KEYWORDS = 40;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?t= をキーワード id にする。形の違うもの・重複は捨てる */
export function parseSuggestTraits(raw: string | string[] | undefined): string[] {
  return [...new Set((first(raw) ?? "").split(",").filter((x) => KEY.test(x)))].slice(0, MAX_KEYWORDS);
}

/** ?area= をエリア id にする。無い・形の違うものは all */
export function parseSuggestArea(raw: string | string[] | undefined): string {
  const v = first(raw);
  return v && KEY.test(v) ? v : "all";
}

export function suggestPlanHref(locale: string, picked: string[], area = "all"): string {
  const p = new URLSearchParams();
  if (picked.length) p.set("t", picked.join(","));
  if (area !== "all") p.set("area", area);
  const s = p.toString().replaceAll("%2C", ",");
  return s ? `/${locale}/plan?${s}` : `/${locale}/plan`;
}

// ---- 提案ページの名前（文字を打たせず、条件から付ける。例「箱根・湖の近く・静か」） ----

export type ProposalNameText = { all: string; sep: string; more: (n: number) => string };

/** エリア（無ければ「すべてのエリア」）とこだわりの先頭 max 個をつなぐ。残りは「ほか N」 */
export function proposalName(areaLabel: string | null, keywordLabels: string[], t: ProposalNameText, max = 3): string {
  const shown = keywordLabels.slice(0, max);
  const rest = keywordLabels.length - shown.length;
  return [areaLabel ?? t.all, ...shown].join(t.sep) + (rest > 0 ? t.more(rest) : "");
}
