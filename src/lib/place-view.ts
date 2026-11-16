// 建物・日帰り温泉・まちの詳細の画面で共通の view の部品。画面に出す文字にして渡す
import type { LocalizedText } from "./accommodation/details.ts";
import { amountText, toHHMM } from "./accommodation/view.ts";
import { resolveLocalizedText } from "./feed.ts";
import { messages } from "./i18n/messages.ts";
import { periodText } from "./nature/view.ts";
import type { PlaceEvent, PlaceHours } from "./place-common.ts";
import type { Locale } from "./types.ts";
import { labelOf, PRICE_AUDIENCE_LIST, SOURCE_TYPE_LIST } from "./vocab/accommodation.ts";

export type { NatureAccessView as AccessView } from "./nature/view.ts";
export { toAccessView } from "./nature/view.ts";

/** 地図の位置（コアの座標）。無ければ null */
export const locationOf = (lat: number | null, lng: number | null) => (lat !== null && lng !== null ? { lat, lng } : null);

/** { ja, en } を今の言語の文にする。無ければ null */
export const textOf = (x: LocalizedText | undefined, locale: Locale): string | null => (x ? resolveLocalizedText(x, locale).text || null : null);

/** 「09:00〜17:00」。片方だけでも出す。どちらも無ければ null */
export function openRange(open: string | undefined, close: string | undefined, locale: Locale): string | null {
  if (open === undefined && close === undefined) return null;
  return messages(locale).accommodation.range(toHHMM(open ?? "") ?? "", toHHMM(close ?? "") ?? "");
}

export type PlaceHoursView = {
  openText: string | null; // 「09:00〜17:00」
  closedDays: string | null; // 「水曜」
  closedNote: string | null;
  lastEntry: string | null; // 「16:30」
  note: string | null;
};

/** 休みの曜日（1=月〜7=日）。「水曜」「水・木曜」 */
function closedDaysText(days: number[] | undefined, locale: Locale): string | null {
  if (!days?.length) return null;
  const c = messages(locale).calendar;
  const list = [...new Set(days)].sort((a, b) => a - b).map((n) => c.weekdays[n - 1]).join(c.weekdaySep);
  return messages(locale).place.closedDays(list);
}

export function toHoursView(h: Partial<PlaceHours>, locale: Locale): PlaceHoursView {
  return {
    openText: openRange(h.open, h.close, locale),
    closedDays: closedDaysText(h.closed_weekdays, locale),
    closedNote: textOf(h.closed_note, locale),
    lastEntry: h.last_entry ? toHHMM(h.last_entry) : null,
    note: textOf(h.note, locale),
  };
}

export type PlaceFeeView = {
  label: string; // 「大人」「子ども（6〜15 歳）」「団体」
  text: string; // 「無料」「1,500 円」
  free: boolean;
  audience: "all" | "adult" | "child" | null;
  tax: string | null; // 「税込」「税別」
  note: string | null;
};

type FeeInput = {
  audience?: "all" | "adult" | "child";
  age_min?: number;
  age_max?: number;
  amount: number;
  amount_max?: number;
  currency: string;
  tax_included?: boolean;
  note?: LocalizedText;
};

/** 「6〜15 歳」「6 歳以上」「15 歳以下」 */
function ageText(min: number | undefined, max: number | undefined, locale: Locale): string | null {
  const a = messages(locale).accommodation;
  if (min !== undefined && max !== undefined) return min === max ? a.price.age(min) : a.price.ages(a.range(String(min), String(max)));
  if (min !== undefined) return a.price.ageMin(min);
  if (max !== undefined) return a.price.ageMax(max);
  return null;
}

/** 「大人」「子ども（6〜15 歳）」「6 歳以上」。区分（全員は除く）も年齢も無ければ null */
export function whoText(f: Pick<FeeInput, "audience" | "age_min" | "age_max">, locale: Locale): string | null {
  const who = f.audience && f.audience !== "all" ? labelOf(PRICE_AUDIENCE_LIST, f.audience, locale) : null;
  const age = ageText(f.age_min, f.age_max, locale);
  if (who && age) return `${who}${messages(locale).accommodation.paren(age)}`;
  return who ?? age;
}

/** 料金 1 行。見出しは name（建物の label）→ 区分・年齢 →（区分が無ければ）メモ → fallback の順 */
export function toFeeView(f: FeeInput, locale: Locale, opts: { name?: string | null; fallback: string }): PlaceFeeView {
  const p = messages(locale).place;
  const free = f.amount === 0 && (f.amount_max === undefined || f.amount_max === 0);
  const note = textOf(f.note, locale);
  const who = whoText(f, locale);
  // 区分も名前も無い料金は、メモを見出しにする（「貸切風呂 50 分」）
  const noteAsLabel = !opts.name && !who && note !== null;
  return {
    label: opts.name ?? who ?? (noteAsLabel ? note : opts.fallback),
    text: free ? p.free : amountText({ amount: f.amount, amountMax: f.amount_max, currency: f.currency }, locale),
    free,
    audience: f.audience ?? null,
    tax: f.tax_included === undefined ? null : f.tax_included ? p.taxIn : p.taxOut,
    note: noteAsLabel ? null : note,
  };
}

/** 料金の中から、概要の 1 行に出す料金（大人があれば大人、なければ先頭） */
export function headlineFee(fees: PlaceFeeView[]): PlaceFeeView | null {
  return fees.find((f) => f.audience === "adult") ?? fees[0] ?? null;
}

export type PlaceEventView = { name: string; when: string | null; note: string | null };

/** 「4・5 月」「Apr, May」 */
function monthsListText(months: number[], locale: Locale): string {
  const c = messages(locale).calendar;
  return [...new Set(months)].sort((a, b) => a - b).map((n) => c.month(n)).join(c.weekdaySep);
}

export function toEventViews(events: PlaceEvent[] | undefined, locale: Locale): PlaceEventView[] {
  return (events ?? []).map((e) => ({
    name: textOf(e.name, locale) ?? "",
    when: periodText(e.date_from, e.date_to, locale) ?? (e.months?.length ? monthsListText(e.months, locale) : null),
    note: textOf(e.note, locale),
  }));
}

export type SourceView = { name: string; url: string; typeLabel: string; retrievedAt: string; fields: string[] };

type SourceInput = { name: string; url: string; type: string; retrieved_at: string; fields?: string[] };

export function toSourceViews(sources: SourceInput[] | undefined, locale: Locale): SourceView[] {
  const a = messages(locale).accommodation;
  return (sources ?? []).map((s) => ({
    name: s.name,
    url: s.url,
    typeLabel: labelOf(SOURCE_TYPE_LIST, s.type, locale),
    retrievedAt: s.retrieved_at,
    fields: (s.fields ?? []).map((f) => a.fields[f] ?? f),
  }));
}
