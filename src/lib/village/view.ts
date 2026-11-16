// まちの詳細の画面に出す形。details（jsonb）を、ラベルと文字にしてから渡す。画面は並べるだけ（宿の view.ts と同じ作り）
import { num } from "../accommodation/view.ts";
import { messages } from "../i18n/messages.ts";
import {
  locationOf,
  openRange,
  textOf,
  toAccessView,
  toEventViews,
  toSourceViews,
  type AccessView,
  type PlaceEventView,
  type SourceView,
} from "../place-view.ts";
import type { Locale } from "../types.ts";
import { villageDetailsSchema } from "./details.ts";

// ---- 出力の形（値の無い欄は null）----

/** 紹介文の下の 1 行（「歩く 約 60 分」「店 10:00〜17:00」） */
export type VillageSummary = { walkText: string | null; shopText: string | null };

export type WalkView = {
  key: string;
  label: string;
  area: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  summary: string | null; // 「約 60 分・1.5 km」
  note: string | null;
};

export type VillageView = {
  summary: VillageSummary;
  walks: WalkView[];
  shopHours: { text: string | null; note: string | null } | null; // text は「10:00〜17:00」
  events: PlaceEventView[];
  access: AccessView | null;
  /** 地図の位置（コアの座標）。無ければ null */
  location: { lat: number; lng: number } | null;
  cautions: string[];
  sources: SourceView[];
};

export type VillageViewInput = {
  details: unknown;
  lat: number | null;
  lng: number | null;
  locale: Locale;
};

/** details を画面の形にする。details が無いか形が違えば null（呼び出し側は facts を出す） */
export function toVillageView(input: VillageViewInput): VillageView | null {
  if (input.details === null || input.details === undefined) return null;
  const parsed = villageDetailsSchema.safeParse(input.details);
  if (!parsed.success) return null;
  const d = parsed.data;
  const locale = input.locale;
  const t = messages(locale).village;
  const a = messages(locale).accommodation;

  const walks = (d.walks ?? []).map((w): WalkView => ({
    key: w.key,
    label: textOf(w.name, locale) ?? w.key,
    area: textOf(w.area, locale),
    durationMinutes: w.duration_minutes ?? null,
    distanceKm: w.distance_km ?? null,
    summary:
      [w.duration_minutes !== undefined ? t.about(w.duration_minutes) : null, w.distance_km !== undefined ? t.km(num(w.distance_km)) : null]
        .filter(Boolean)
        .join(a.sep) || null,
    note: textOf(w.note, locale),
  }));
  const shopHours = d.shop_hours
    ? { text: openRange(d.shop_hours.open, d.shop_hours.close, locale), note: textOf(d.shop_hours.note, locale) }
    : null;

  const firstMinutes = walks[0]?.durationMinutes ?? null;

  return {
    summary: { walkText: firstMinutes === null ? null : t.about(firstMinutes), shopText: shopHours?.text ?? null },
    walks,
    shopHours,
    events: toEventViews(d.events, locale),
    access: d.access ? toAccessView(d.access, locale) : null,
    location: locationOf(input.lat, input.lng),
    cautions: (d.cautions ?? []).flatMap((x) => textOf(x.note, locale) ?? []),
    sources: toSourceViews(d.sources, locale),
  };
}
