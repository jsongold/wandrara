// 日帰り温泉の詳細の画面に出す形。details（jsonb）を、ラベルと文字にしてから渡す。画面は並べるだけ（宿の view.ts と同じ作り）
import { formatMoney } from "../accommodation/view.ts";
import { messages } from "../i18n/messages.ts";
import {
  locationOf,
  textOf,
  toAccessView,
  toFeeView,
  toHoursView,
  toSourceViews,
  type AccessView,
  type PlaceFeeView,
  type PlaceHoursView,
  type SourceView,
} from "../place-view.ts";
import type { Locale } from "../types.ts";
import { BATH_GENDER_LIST, BATH_KIND_LIST, HOT_SPRING_SOURCE_LIST, labelOf, TOWEL_LIST } from "../vocab/hotspring.ts";
import { hotspringDetailsSchema } from "./details.ts";

// ---- 出力の形（値の無い欄は null）----

/** 紹介文の下の 1 行（「営業 10:00〜21:00」「大人 1,000 円」） */
export type HotspringSummary = { openText: string | null; adultFeeText: string | null };

export type HotspringBathView = {
  kind: string;
  label: string; // 露天風呂・内風呂・貸切風呂・サウナ
  text: string; // 「温泉・源泉かけ流し」。何も分からなければ「あり」
  spring: string | null; // 泉質
  genderLabel: string | null;
  feeText: string | null; // 「50 分 2,000 円」
  reservationText: string | null; // 「予約が必要」「当日受付」
  note: string | null;
};

export type HotspringAmenitiesView = {
  towelText: string | null; // 「貸し出し（200 円）」
  restArea: string | null; // あり・なし
  meal: string | null;
  note: string | null;
};

export type HotspringView = {
  summary: HotspringSummary;
  baths: HotspringBathView[];
  hours: PlaceHoursView | null;
  fees: PlaceFeeView[];
  amenities: HotspringAmenitiesView | null;
  access: AccessView | null;
  /** 地図の位置（コアの座標）。無ければ null */
  location: { lat: number; lng: number } | null;
  officialUrl: string | null;
  cautions: string[];
  sources: SourceView[];
};

export type HotspringViewInput = {
  details: unknown;
  lat: number | null;
  lng: number | null;
  officialUrl?: string | null;
  locale: Locale;
};

/** details を画面の形にする。details が無いか形が違えば null（呼び出し側は facts を出す） */
export function toHotspringView(input: HotspringViewInput): HotspringView | null {
  if (input.details === null || input.details === undefined) return null;
  const parsed = hotspringDetailsSchema.safeParse(input.details);
  if (!parsed.success) return null;
  const d = parsed.data;
  const locale = input.locale;
  const t = messages(locale).hotspring;
  const a = messages(locale).accommodation;
  const yesNo = (v: boolean | undefined) => (v === undefined ? null : v ? a.has : a.hasNot);
  const money = (m: { amount: number; currency: string; tax_included?: boolean } | undefined) =>
    m ? formatMoney({ amount: m.amount, currency: m.currency, taxIncluded: m.tax_included }, locale) : null;

  const hours = d.hours ? toHoursView(d.hours, locale) : null;
  const fees = (d.fees ?? []).map((f) => toFeeView(f, locale, { fallback: t.fee }));
  const adult = fees.find((f) => f.audience === "adult") ?? null;

  return {
    summary: { openText: hours?.openText ?? null, adultFeeText: adult?.text ?? null },
    baths: (d.baths ?? []).map((b) => {
      const slot = b.reservation?.slot_minutes !== undefined ? t.bath.slot(b.reservation.slot_minutes) : null;
      return {
        kind: b.kind,
        label: labelOf(BATH_KIND_LIST, b.kind, locale),
        text:
          [b.hot_spring === undefined ? null : b.hot_spring ? t.hotSpring : t.notHotSpring, b.source ? labelOf(HOT_SPRING_SOURCE_LIST, b.source, locale) : null].filter(Boolean).join(a.sep) || a.has,
        spring: b.spring ?? null,
        genderLabel: b.gender ? labelOf(BATH_GENDER_LIST, b.gender, locale) : null,
        feeText: [slot, money(b.fee)].filter(Boolean).join(" ") || null,
        reservationText: b.reservation ? (b.reservation.required ? t.bath.required : t.bath.walkIn) : null,
        note: textOf(b.note, locale),
      };
    }),
    hours,
    fees,
    amenities: d.amenities
      ? {
          // タオルの区分が無くても、料金だけあれば出す
          towelText: d.amenities.towel
            ? labelOf(TOWEL_LIST, d.amenities.towel, locale) + (d.amenities.towel_fee ? a.paren(money(d.amenities.towel_fee)!) : "")
            : money(d.amenities.towel_fee),
          restArea: yesNo(d.amenities.rest_area),
          meal: yesNo(d.amenities.meal),
          note: textOf(d.amenities.note, locale),
        }
      : null,
    access: d.access ? toAccessView(d.access, locale) : null,
    location: locationOf(input.lat, input.lng),
    officialUrl: input.officialUrl ?? null,
    cautions: (d.cautions ?? []).flatMap((x) => textOf(x.note, locale) ?? []),
    sources: toSourceViews(d.sources, locale),
  };
}

