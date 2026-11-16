// 画面の「料金（参考）」の表。部屋ごとに最小〜最大だけを出し、区分（平日・休日など）ごとの値は出さない
import { PRICE_MEALS } from "../vocab/accommodation.ts";
import type { PriceItem, Prices } from "./prices.ts";

/** 区分をまとめた料金 1 件。amount〜amount_max・rate_percent〜rate_percent_max は区分をまたいだ幅 */
export type PriceLine = Omit<PriceItem, "season"> & {
  rate_percent_max?: number;
  includedInRoom?: true; // どの宿泊料にも込み（別には払わない）
};

/** 料金がかかる人（大人・年齢） */
export type PriceWho = { audience?: string; age_min?: number; age_max?: number };

export type PriceHintRow = {
  room: string | null;
  per: string; // この行の単位（PRICE_PERS のコード）
  currency: string;
  taxIncluded: boolean | null; // この行の単位の税込。混ざっているか分からないときは null
  guestsMin?: number;
  guestsMax?: number;
  min: number;
  max: number;
  meals: string[]; // PRICE_MEALS のコード。重ならず、語彙の順
  who: PriceWho[]; // 重ならず、出た順。全員・条件なしは入れない
  includes: string[]; // どの料金にも込みの種類
  includesSome: string[]; // 一部の料金だけ込みの種類
};

export type PriceHint = {
  per: string | null; // 主な単位。大人の宿泊料が無ければ null
  currency: string | null;
  taxIncluded: boolean | null; // 主な単位の税込。混ざっているか分からないときは null
  rows: PriceHintRow[]; // 主な単位の行が先、ほかの単位の行は後
  fees: PriceLine[]; // 宿泊料に込みのものも残す（includedInRoom で見分ける）
  children: PriceLine[];
};

const FEE_KINDS: readonly string[] = ["service_fee", "bath_tax", "lodging_tax", "cleaning", "meal"];

const isChild = (it: PriceItem) => it.audience === "child" || it.rate_percent !== undefined;

function groupBy<T, K>(xs: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

const taxOf = (items: PriceItem[]) => {
  const taxes = new Set(items.map((it) => it.tax_included));
  return taxes.size === 1 && !taxes.has(undefined) ? items[0].tax_included! : null;
};

/** 部屋ごとの料金の幅と、別にかかる料金・子どもの料金。料金が 1 件も無ければ null */
export function priceHint(input: { rooms?: { key: string }[]; prices?: Prices }): PriceHint | null {
  const items = input.prices?.items ?? [];
  if (items.length === 0) return null;
  const roomItems = items.filter((it) => it.kind === "room");
  const candidates = roomItems.filter((it) => it.amount !== undefined && !isChild(it));

  // 単位（per, currency）ごとに分け、多い順。同じ数なら先に出たもの（sort は安定）
  const units = [...groupBy(candidates, (it) => `${it.per} ${it.currency}`).values()].sort((a, b) => b.length - a.length);
  const roomKeys = (input.rooms ?? []).map((r) => r.key);
  const rows = units.flatMap((u) => roomRows(u, roomKeys));
  const main = units[0];

  // どの宿泊料にも込みの種類は、消さずに印を付ける（別途かかる料金として数えない）
  const included = (kind: string) =>
    candidates.length > 0 && candidates.every((it) => (it.includes as readonly string[] | undefined)?.includes(kind));
  const fees = mergeLines(items.filter((it) => FEE_KINDS.includes(it.kind))).map((l) =>
    included(l.kind) ? { ...l, includedInRoom: true as const } : l,
  );
  const children = mergeLines(roomItems.filter(isChild));

  return {
    per: main ? main[0].per : null,
    currency: main ? main[0].currency : null,
    taxIncluded: main ? taxOf(main) : null,
    rows,
    fees,
    children,
  };
}

/** 同じ単位の宿泊料を部屋ごとに 1 行にする */
function roomRows(unit: PriceItem[], roomKeys: string[]): PriceHintRow[] {
  // 部屋が 1 つだけなら、room の無い料金はその部屋のもの
  const only = roomKeys.length === 1 ? roomKeys[0] : null;
  const groups = groupBy(unit, (it) => it.room ?? only);
  // rooms の順、rooms に無い key は出た順、room の無いものは最後
  const order = [...roomKeys.filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => k !== null && !roomKeys.includes(k))];
  if (groups.has(null)) order.push(null);
  const tax = taxOf(unit);
  return order.map((k) => toRow(k, groups.get(k)!, tax));
}

function toRow(room: string | null, items: PriceItem[], taxIncluded: boolean | null): PriceHintRow {
  const whos = new Map<string, PriceWho>();
  for (const it of items) {
    const w: PriceWho = {};
    if (it.audience !== undefined && it.audience !== "all") w.audience = it.audience;
    if (it.age_min !== undefined) w.age_min = it.age_min;
    if (it.age_max !== undefined) w.age_max = it.age_max;
    if (Object.keys(w).length > 0) whos.set(JSON.stringify(w), w);
  }
  const incl = (it: PriceItem) => (it.includes ?? []) as readonly string[];
  const kinds = [...new Set(items.flatMap(incl))];
  const row: PriceHintRow = {
    room,
    per: items[0].per,
    currency: items[0].currency,
    taxIncluded,
    min: Math.min(...items.map((it) => it.amount!)),
    max: Math.max(...items.map((it) => it.amount_max ?? it.amount!)),
    // meals が無い料金は、食事が分からないので数えない
    meals: PRICE_MEALS.filter((m) => items.some((it) => it.meals === m)),
    who: [...whos.values()],
    includes: kinds.filter((k) => items.every((it) => incl(it).includes(k))),
    includesSome: kinds.filter((k) => !items.every((it) => incl(it).includes(k))),
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

// 区分と金額（割合）のほかが同じ料金は 1 件にまとめる
const lineKey = (it: PriceItem) =>
  JSON.stringify([
    it.kind,
    it.per,
    it.audience,
    it.age_min,
    it.age_max,
    it.room,
    it.guests_min,
    it.guests_max,
    it.currency,
    it.tax_included,
    [...(it.includes ?? [])].sort(),
    it.meals,
    it.amount !== undefined ? "amount" : "rate",
  ]);

const VALUE_KEYS = ["season", "amount", "amount_max", "rate_percent"];

/** 区分ごとの料金を、条件ごとに最小〜最大の 1 件にまとめる。区分ごとの値は残さない */
function mergeLines(items: PriceItem[]): PriceLine[] {
  return [...groupBy(items, lineKey).values()].map((g) => {
    const line = Object.fromEntries(Object.entries(g[0]).filter(([k]) => !VALUE_KEYS.includes(k))) as PriceLine;
    if (g[0].amount !== undefined) {
      line.amount = Math.min(...g.map((it) => it.amount!));
      const max = Math.max(...g.map((it) => it.amount_max ?? it.amount!));
      if (max !== line.amount) line.amount_max = max;
    } else {
      line.rate_percent = Math.min(...g.map((it) => it.rate_percent!));
      const max = Math.max(...g.map((it) => it.rate_percent!));
      if (max !== line.rate_percent) line.rate_percent_max = max;
    }
    return line;
  });
}
