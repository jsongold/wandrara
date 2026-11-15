// 画面の「料金（参考）」の表。部屋ごとに最小〜最大だけを出し、区分（平日・休日など）ごとの値は出さない
import { PRICE_MEALS } from "../vocab/accommodation.ts";
import type { PriceItem, Prices } from "./prices.ts";

export type PriceHintRow = {
  room: string | null;
  guestsMin?: number;
  guestsMax?: number;
  min: number;
  max: number;
  meals: string[]; // PRICE_MEALS のコード。重ならず、語彙の順
};

export type PriceHint = {
  per: string; // PRICE_PERS のコード
  currency: string;
  taxIncluded: boolean | null; // 混ざっているか分からないときは null
  rows: PriceHintRow[];
  fees: PriceItem[];
  children: PriceItem[];
  issues: string[];
};

const FEE_KINDS: readonly string[] = ["service_fee", "bath_tax", "lodging_tax", "cleaning", "meal"];

const isChild = (it: PriceItem) => it.audience === "child" || it.rate_percent !== undefined;

/** 部屋ごとの料金の幅と、別にかかる料金・子どもの料金。宿泊料が無ければ null */
export function priceHint(input: { rooms?: { key: string }[]; prices?: Prices }): PriceHint | null {
  const items = input.prices?.items ?? [];
  const roomItems = items.filter((it) => it.kind === "room");
  const candidates = roomItems.filter((it) => it.amount !== undefined && !isChild(it));
  if (candidates.length === 0) return null;

  // いちばん多い（per, currency）で比べる。同じ数なら先に出たもの
  const unitKey = (it: PriceItem) => `${it.per} ${it.currency}`;
  const counts = new Map<string, number>();
  for (const it of candidates) counts.set(unitKey(it), (counts.get(unitKey(it)) ?? 0) + 1);
  let best = unitKey(candidates[0]);
  for (const [k, n] of counts) if (n > counts.get(best)!) best = k;
  const chosen = candidates.filter((it) => unitKey(it) === best);
  const { per, currency } = chosen[0];

  const issues: string[] = [];
  const skipped = candidates.length - chosen.length;
  if (skipped > 0) issues.push(`単位か通貨の違う宿泊料があり、比べていない（${skipped} 件）`);

  // 部屋が 1 つだけなら、room の無い料金はその部屋のもの
  const roomKeys = (input.rooms ?? []).map((r) => r.key);
  const only = roomKeys.length === 1 ? roomKeys[0] : null;
  const groups = new Map<string | null, PriceItem[]>();
  for (const it of chosen) {
    const key = it.room ?? only;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  // rooms の順、rooms に無い key は出た順、room の無いものは最後
  const order = [...roomKeys.filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => k !== null && !roomKeys.includes(k))];
  if (groups.has(null)) order.push(null);
  const rows = order.map((k) => toRow(k, groups.get(k)!));

  const taxes = new Set(chosen.map((it) => it.tax_included));
  const taxIncluded = taxes.size === 1 && !taxes.has(undefined) ? chosen[0].tax_included! : null;

  // どの宿泊料にも込みの種類は、二重に数えないよう外す
  const included = (kind: string) => chosen.every((it) => (it.includes as readonly string[] | undefined)?.includes(kind));
  const fees = items.filter((it) => FEE_KINDS.includes(it.kind) && !included(it.kind));
  const children = roomItems.filter(isChild);

  return { per, currency, taxIncluded, rows, fees, children, issues };
}

function toRow(room: string | null, items: PriceItem[]): PriceHintRow {
  const row: PriceHintRow = {
    room,
    min: Math.min(...items.map((it) => it.amount!)),
    max: Math.max(...items.map((it) => it.amount_max ?? it.amount!)),
    // meals が無い料金は、食事が分からないので数えない
    meals: PRICE_MEALS.filter((m) => items.some((it) => it.meals === m)),
  };
  const mins = items.flatMap((it) => (it.guests_min !== undefined ? [it.guests_min] : []));
  const maxs = items.flatMap((it) => {
    const g = it.guests_max ?? it.guests_min;
    return g !== undefined ? [g] : [];
  });
  if (mins.length > 0) row.guestsMin = Math.min(...mins);
  if (maxs.length > 0) row.guestsMax = Math.max(...maxs);
  return row;
}
