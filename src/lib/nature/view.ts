// 自然の詳細の画面に出す形。details（jsonb）を、ラベルと文字にしてから渡す。画面は並べるだけ（宿の view.ts と同じ作り）
import type { LocalizedText } from "../accommodation/details.ts";
import { amountText, num, toHHMM } from "../accommodation/view.ts";
import { resolveLocalizedText } from "../feed.ts";
import { messages } from "../i18n/messages.ts";
import type { Locale } from "../types.ts";
import { labelOf, PRICE_AUDIENCE_LIST, SOURCE_TYPE_LIST } from "../vocab/accommodation.ts";
import { ACCESS_MODE_LIST, DIFFICULTY_LIST, RESTRICTION_KIND_LIST } from "../vocab/nature.ts";
import { natureDetailsSchema, type NatureDetails } from "./details.ts";

// ---- 出力の形（値の無い欄は null）----

/** 紹介文の下の 1 行（「見頃 4〜5 月」「入場無料」） */
export type NatureSummary = { seasonText: string | null; feeText: string | null };

export type NatureSeasonView = { subject: string; months: string };

export type NatureHoursView = {
  alwaysOpen: boolean;
  text: string | null; // 「いつでも」「09:00〜17:00」
  closedNote: string | null;
};

export type NatureFeeView = {
  audienceLabel: string | null; // 大人・子ども。全員か指定なしは null
  text: string; // 「無料」「300 円」「300〜500 円」
  free: boolean;
  note: string | null;
};

export type NatureAccessView = {
  station: string | null;
  modeLabel: string | null; // 徒歩・バス・車
  minutes: number | null;
  how: string | null; // 「徒歩 15 分」
  parking: { available: boolean; spaces: number | null; paid: boolean | null; text: string } | null; // text は「あり（有料・80 台）」
  route: string | null;
};

export type TrailView = {
  key: string;
  label: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  difficulty: string | null; // easy など
  difficultyLabel: string | null;
  durationMinutes: number | null;
  summary: string | null; // 「3.2 km・90 分」
};

export type RestrictionView = { kind: string; kindLabel: string; note: string | null; period: string | null; dateFrom: string | null; dateTo: string | null };

export type NatureView = {
  summary: NatureSummary;
  seasons: NatureSeasonView[];
  hours: NatureHoursView | null;
  fees: NatureFeeView[];
  access: NatureAccessView | null;
  /** 地図の位置（コアの座標）。無ければ null */
  location: { lat: number; lng: number } | null;
  trails: TrailView[];
  restrictions: RestrictionView[];
  cautions: string[];
  sources: { name: string; url: string; typeLabel: string; retrievedAt: string; fields: string[] }[];
};

export type NatureViewInput = {
  details: unknown;
  lat: number | null;
  lng: number | null;
  locale: Locale;
};

// ---- 組み立て ----

/** details を画面の形にする。details が無いか形が違えば null（呼び出し側は facts を出す） */
export function toNatureView(input: NatureViewInput): NatureView | null {
  if (input.details === null || input.details === undefined) return null;
  const parsed = natureDetailsSchema.safeParse(input.details);
  if (!parsed.success) return null;
  const d: NatureDetails = parsed.data;
  const locale = input.locale;
  const t = messages(locale).nature;
  const a = messages(locale).accommodation;
  const c = messages(locale).calendar;
  const text = (x: LocalizedText | undefined) => (x ? resolveLocalizedText(x, locale).text || null : null);

  const seasons = (d.seasons ?? []).map((s) => ({ subject: text(s.subject) ?? "", months: c.monthRange(s.month_from, s.month_to) }));
  const fees = (d.fees ?? []).map((f): NatureFeeView => {
    const free = f.amount === 0 && (f.amount_max === undefined || f.amount_max === 0);
    return {
      audienceLabel: f.audience && f.audience !== "all" ? labelOf(PRICE_AUDIENCE_LIST, f.audience, locale) : null,
      text: free ? t.freeShort : amountText({ amount: f.amount, amountMax: f.amount_max, currency: f.currency }, locale),
      free,
      note: text(f.note),
    };
  });

  return {
    summary: {
      seasonText: seasons[0]?.months ?? null,
      feeText: feeSummary(d, locale),
    },
    seasons,
    hours: d.hours
      ? {
          alwaysOpen: d.hours.always_open ?? false,
          text: d.hours.always_open
            ? t.alwaysOpen
            : d.hours.open !== undefined || d.hours.close !== undefined
              ? a.range(toHHMM(d.hours.open ?? "") ?? "", toHHMM(d.hours.close ?? "") ?? "")
              : null,
          closedNote: text(d.hours.closed_note),
        }
      : null,
    fees,
    access: d.access ? toAccessView(d.access, locale) : null,
    location: input.lat !== null && input.lng !== null ? { lat: input.lat, lng: input.lng } : null,
    trails: (d.trails ?? []).map((tr) => ({
      key: tr.key,
      label: text(tr.name) ?? tr.key,
      distanceKm: tr.distance_km ?? null,
      elevationGainM: tr.elevation_gain_m ?? null,
      difficulty: tr.difficulty ?? null,
      difficultyLabel: tr.difficulty ? labelOf(DIFFICULTY_LIST, tr.difficulty, locale) : null,
      durationMinutes: tr.duration_minutes ?? null,
      summary:
        [tr.distance_km !== undefined ? t.trail.distance(num(tr.distance_km)) : null, tr.duration_minutes !== undefined ? t.trail.minutes(tr.duration_minutes) : null]
          .filter(Boolean)
          .join(a.sep) || null,
    })),
    restrictions: (d.restrictions ?? []).map((r) => ({
      kind: r.kind,
      kindLabel: labelOf(RESTRICTION_KIND_LIST, r.kind, locale),
      note: text(r.note),
      period: periodText(r.date_from, r.date_to, locale),
      dateFrom: r.date_from ?? null,
      dateTo: r.date_to ?? null,
    })),
    cautions: (d.cautions ?? []).flatMap((x) => text(x.note) ?? []),
    sources: (d.sources ?? []).map((s) => ({
      name: s.name,
      url: s.url,
      typeLabel: labelOf(SOURCE_TYPE_LIST, s.type, locale),
      retrievedAt: s.retrieved_at,
      fields: (s.fields ?? []).map((f) => a.fields[f] ?? f),
    })),
  };
}

/** 行き方（自然・建物・日帰り温泉・まちで共通） */
export function toAccessView(access: NonNullable<NatureDetails["access"]>, locale: Locale): NatureAccessView {
  const t = messages(locale).nature;
  const a = messages(locale).accommodation;
  const text = (x: LocalizedText | undefined) => (x ? resolveLocalizedText(x, locale).text || null : null);
  return {
    station: text(access.station),
    modeLabel: access.mode ? labelOf(ACCESS_MODE_LIST, access.mode, locale) : null,
    minutes: access.minutes ?? null,
    how:
      access.minutes === undefined
        ? null
        : access.mode
          ? t.access.how(labelOf(ACCESS_MODE_LIST, access.mode, locale), access.minutes)
          : a.access.minutes(access.minutes), // 手段が無くても分は出す
    parking: access.parking ? { ...parkingView(access.parking, locale) } : null,
    route: text(access.route),
  };
}

/** 駐車場。「あり（有料・80 台）」「なし」 */
function parkingView(p: { available: boolean; spaces?: number; paid?: boolean }, locale: Locale) {
  const t = messages(locale).nature;
  const a = messages(locale).accommodation;
  const detail = [p.paid === undefined ? null : p.paid ? t.parking.paid : t.parking.free, p.spaces !== undefined ? t.parking.spaces(p.spaces) : null].filter(Boolean).join(a.sep);
  const word = p.available ? t.parking.yes : t.parking.no;
  return {
    available: p.available,
    spaces: p.spaces ?? null,
    paid: p.paid ?? null,
    text: p.available && detail ? `${word}${a.paren(detail)}` : word,
  };
}

/** 規制の期間。「2026-12-01〜2027-02-28」「2026-12-01 から」「2027-02-28 まで」 */
export function periodText(from: string | undefined, to: string | undefined, locale: Locale): string | null {
  const t = messages(locale).nature.restriction;
  if (from && to) return t.period(from, to);
  if (from) return t.since(from);
  if (to) return t.until(to);
  return null;
}

/** 紹介文の下の入場の文。全部無料なら「入場無料」、そうでなければ最小〜最大「入場 300〜500 円」。料金の記載が無ければ null */
function feeSummary(d: NatureDetails, locale: Locale): string | null {
  const fees = d.fees ?? [];
  if (fees.length === 0) return null;
  const t = messages(locale).nature;
  const max = Math.max(...fees.map((f) => f.amount_max ?? f.amount));
  if (max === 0) return t.free;
  const currencies = [...new Set(fees.map((f) => f.currency))];
  // 通貨が混ざるときは 1 つの範囲にできないので、最初の料金だけ出す
  const use = currencies.length === 1 ? fees : [fees[0]];
  const min = Math.min(...use.map((f) => f.amount));
  return t.fee(amountText({ amount: min, amountMax: Math.max(...use.map((f) => f.amount_max ?? f.amount)), currency: use[0].currency }, locale));
}
