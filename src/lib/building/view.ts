// 建物の詳細の画面に出す形。details（jsonb）を、ラベルと文字にしてから渡す。画面は並べるだけ（宿の view.ts と同じ作り）
import { messages } from "../i18n/messages.ts";
import {
  headlineFee,
  locationOf,
  textOf,
  toAccessView,
  toEventViews,
  toFeeView,
  toHoursView,
  toSourceViews,
  type AccessView,
  type PlaceEventView,
  type PlaceFeeView,
  type PlaceHoursView,
  type SourceView,
} from "../place-view.ts";
import type { Locale } from "../types.ts";
import { buildingDetailsSchema } from "./details.ts";

// ---- 出力の形（値の無い欄は null）----

/** 紹介文の下の 1 行（「開館 09:00〜17:00」「入館 1,500 円」） */
export type BuildingSummary = { openText: string | null; feeText: string | null };

export type BuildingView = {
  summary: BuildingSummary;
  hours: PlaceHoursView | null;
  fees: PlaceFeeView[];
  events: PlaceEventView[];
  access: AccessView | null;
  /** 地図の位置（コアの座標）。無ければ null */
  location: { lat: number; lng: number } | null;
  cautions: string[];
  bookingLinks: { label: string; url: string; isOfficial: boolean }[];
  sources: SourceView[];
};

export type BuildingViewInput = {
  details: unknown;
  lat: number | null;
  lng: number | null;
  locale: Locale;
};

/** details を画面の形にする。details が無いか形が違えば null（呼び出し側は facts を出す） */
export function toBuildingView(input: BuildingViewInput): BuildingView | null {
  if (input.details === null || input.details === undefined) return null;
  const parsed = buildingDetailsSchema.safeParse(input.details);
  if (!parsed.success) return null;
  const d = parsed.data;
  const locale = input.locale;
  const t = messages(locale).building;
  const hours = d.hours ? toHoursView(d.hours, locale) : null;
  const fees = (d.fees ?? []).map((f) => toFeeView(f, locale, { name: textOf(f.label, locale), fallback: t.fee }));

  return {
    summary: { openText: hours?.openText ?? null, feeText: headlineFee(fees)?.text ?? null },
    hours,
    fees,
    events: toEventViews(d.events, locale),
    access: d.access ? toAccessView(d.access, locale) : null,
    location: locationOf(input.lat, input.lng),
    cautions: (d.cautions ?? []).flatMap((x) => textOf(x.note, locale) ?? []),
    bookingLinks: (d.booking_links ?? []).map((b) => ({ label: b.label, url: b.url, isOfficial: b.is_official ?? false })),
    sources: toSourceViews(d.sources, locale),
  };
}
