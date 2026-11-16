// 体験の詳細の画面に出す形。details（jsonb）を、ラベルと文字にしてから渡す。画面は並べるだけ（宿の view.ts と同じ作り）
import { amountText, toHHMM } from "../accommodation/view.ts";
import { resolveLocalizedText } from "../feed.ts";
import { messages } from "../i18n/messages.ts";
import type { Locale } from "../types.ts";
import type { LocalizedText } from "../accommodation/details.ts";
import { labelOf, SOURCE_TYPE_LIST, type Term } from "../vocab/accommodation.ts";
import { INCLUSION_KIND_LIST, LOCATION_KIND_LIST, PRICE_PER_LIST } from "../vocab/experience.ts";
import { experienceDetailsSchema, type ExperienceDetails, type ExperiencePriceItem } from "./details.ts";

// ---- 出力の形（値の無い欄は null）----

/** 紹介文の下の 1 行（「所要 90 分」「予約必要」）。コアの列から */
export type ExperienceSummary = { durationMinutes: number | null; reservationRequired: boolean | null };

export type ExperiencePriceRow = {
  courseLabel: string; // コースの名前。コースの無い料金は「全コース」
  people: string | null; // 「1〜20」
  min: number;
  max: number;
  currency: string;
  perLabel: string; // 「1 名」「1 グループ」「1 回」
  /** 行を開いたときの文（「大人 3,500 円」「子ども（6〜12 歳） 2,500 円」「人数 2〜8 名」）。区分ごとの値は出さない */
  notes: string[];
};

export type ExperiencePriceTable = {
  unitLabel: string | null; // 「税込（円）」。rows が空なら null
  currency: string | null; // 混ざっているときは null
  taxIncluded: boolean | null; // 混ざっているか分からないときは null
  rows: ExperiencePriceRow[];
  officialUrl: string | null; // 「料金の詳細は公式サイトへ」
};

export type CourseView = {
  key: string;
  label: string;
  description: string | null;
  durationMinutes: number | null;
  durationText: string | null; // 「90 分」
  people: string | null; // 「1〜20」
  ageText: string | null; // 「6 歳から」
  languages: string[]; // 「日本語」「英語」
};

export type ScheduleView = {
  months: string | null; // 「3〜11 月」
  weekdays: string | null; // 「金・土・日」
  times: string | null; // 「10:00 / 14:00」
  endTime: string | null; // 「17:00」
  rainPolicy: string | null;
};

export type LocationView = {
  kind: string;
  kindLabel: string; // 集合場所・実施場所
  label: string; // note があれば note、なければ kindLabel
  address: string | null;
  lat: number;
  lng: number;
  geoPrecision: string;
};

export type InclusionGroupView = { kind: string; label: string; items: string[] };

export type ExperienceView = {
  summary: ExperienceSummary;
  priceTable: ExperiencePriceTable | null;
  courses: CourseView[];
  schedules: ScheduleView[];
  locations: LocationView[];
  inclusions: InclusionGroupView[]; // 含む・含まない・持ち物の順。空のグループは出さない
  cautions: string[];
  bookingLinks: { label: string; url: string; isOfficial: boolean }[];
  sources: { name: string; url: string; typeLabel: string; retrievedAt: string; fields: string[] }[];
};

export type ExperienceViewInput = {
  details: unknown;
  durationMinutes: number | null;
  reservationRequired: boolean | null;
  officialUrl: string | null;
  locale: Locale;
};

// ---- 小道具 ----

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/** 「1〜20」。同じなら「1」 */
function rangeText(locale: Locale, min: number | undefined, max: number | undefined): string | null {
  if (min === undefined && max === undefined) return null;
  if (min === undefined || max === undefined || min === max) return String(min ?? max);
  return messages(locale).accommodation.range(String(min), String(max));
}

/** 「大人」「子ども（6〜12 歳）」「6 歳以上」。区分も年齢も無ければ空 */
function whoText(it: ExperiencePriceItem, locale: Locale): string {
  const a = messages(locale).accommodation;
  const t = messages(locale).experience;
  const who = it.audience === "adult" ? t.audience.adult : it.audience === "child" ? t.audience.child : null;
  const min = it.age_min;
  const max = it.age_max;
  const age =
    min !== undefined && max !== undefined
      ? min === max
        ? a.price.age(min)
        : a.price.ages(a.range(String(min), String(max)))
      : min !== undefined
        ? a.price.ageMin(min)
        : max !== undefined
          ? a.price.ageMax(max)
          : null;
  if (who && age) return `${who}${a.paren(age)}`;
  return who ?? age ?? "";
}

// ---- 組み立て ----

/** details を画面の形にする。details が無いか形が違えば null（呼び出し側は facts を出す） */
export function toExperienceView(input: ExperienceViewInput): ExperienceView | null {
  if (input.details === null || input.details === undefined) return null;
  const parsed = experienceDetailsSchema.safeParse(input.details);
  if (!parsed.success) return null;
  const d: ExperienceDetails = parsed.data;
  const locale = input.locale;
  const t = messages(locale).experience;
  const a = messages(locale).accommodation;
  const label = (list: readonly Term[], code: string) => labelOf(list, code, locale);
  const text = (x: LocalizedText | undefined) => (x ? resolveLocalizedText(x, locale).text || null : null);

  return {
    summary: { durationMinutes: input.durationMinutes, reservationRequired: input.reservationRequired },
    priceTable: priceTable(d, input.officialUrl, locale),
    courses: (d.courses ?? []).map((c) => ({
      key: c.key,
      label: text(c.name) ?? c.key,
      description: text(c.description),
      durationMinutes: c.duration_minutes ?? null,
      durationText: c.duration_minutes !== undefined ? t.minutes(c.duration_minutes) : null,
      people: rangeText(locale, c.people_min, c.people_max),
      ageText: c.age_min !== undefined ? t.course.ageMin(c.age_min) : null,
      languages: (c.languages ?? []).map((l) => t.languageNames[l] ?? l),
    })),
    schedules: (d.schedules ?? []).map((s) => ({
      months: monthsText(s.months_from, s.months_to, locale),
      weekdays: weekdaysText(s.weekdays, locale),
      times: s.start_times?.length ? s.start_times.join(t.schedule.timesSep) : null,
      endTime: s.end_time ? toHHMM(s.end_time) : null,
      rainPolicy: text(s.rain_policy),
    })),
    locations: (d.locations ?? []).map((l) => {
      const kindLabel = label(LOCATION_KIND_LIST, l.kind);
      return { kind: l.kind, kindLabel, label: text(l.note) ?? kindLabel, address: text(l.address), lat: l.lat, lng: l.lng, geoPrecision: l.geo_precision };
    }),
    inclusions: INCLUSION_KIND_LIST.flatMap((k) => {
      const items = (d.inclusions ?? []).filter((i) => i.kind === k.code).flatMap((i) => text(i.item) ?? []);
      return items.length ? [{ kind: k.code, label: label(INCLUSION_KIND_LIST, k.code), items }] : [];
    }),
    cautions: (d.cautions ?? []).flatMap((c) => text(c.note) ?? []),
    bookingLinks: (d.booking_links ?? []).map((b) => ({ label: b.label, url: b.url, isOfficial: b.is_official ?? false })),
    sources: (d.sources ?? []).map((s) => ({
      name: s.name,
      url: s.url,
      typeLabel: label(SOURCE_TYPE_LIST, s.type),
      retrievedAt: s.retrieved_at,
      fields: (s.fields ?? []).map((f) => a.fields[f] ?? f),
    })),
  };
}

/** 「3〜11 月」。片方だけなら、ある方だけ。無ければ null */
function monthsText(from: number | undefined, to: number | undefined, locale: Locale): string | null {
  const c = messages(locale).calendar;
  if (from === undefined && to === undefined) return null;
  return c.monthRange(from ?? to!, to ?? from!);
}

/** 「金・土・日」。7 つ全部なら「毎日」。曜日の順に並べる */
function weekdaysText(days: number[] | undefined, locale: Locale): string | null {
  if (!days?.length) return null;
  const c = messages(locale).calendar;
  if (days.length === 7) return c.everyDay;
  return [...days].sort((x, y) => x - y).map((n) => c.weekdays[n - 1]).join(c.weekdaySep);
}

/** 料金（参考）の表。コース × 単位ごとに 1 行、最小〜最大だけ。区分（時期）ごとの値は出さない */
function priceTable(d: ExperienceDetails, officialUrl: string | null, locale: Locale): ExperiencePriceTable | null {
  const items = d.prices?.items ?? [];
  if (items.length === 0) return null;
  const t = messages(locale).experience;
  const a = messages(locale).accommodation;
  const courses = d.courses ?? [];
  const courseLabel = (key: string | undefined) => {
    if (key === undefined) return courses.length ? t.allCourses : t.title.price;
    const c = courses.find((x) => x.key === key);
    return (c && resolveLocalizedText(c.name, locale).text) || key;
  };

  // コース（無いものは全コース）と単位が同じ料金を 1 行にまとめる。並びは最初に出た順
  const groups = new Map<string, ExperiencePriceItem[]>();
  for (const it of items) {
    const k = `${it.course ?? ""}\u0000${it.per}\u0000${it.currency}`;
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const rows = [...groups.values()].map((g): ExperiencePriceRow => {
    const first = g[0];
    const course = courses.find((c) => c.key === first.course);
    const peopleOf = (pick: (i: ExperiencePriceItem) => number | undefined, f: (...n: number[]) => number) => {
      const ns = g.flatMap((i) => pick(i) ?? []);
      return ns.length ? f(...ns) : undefined;
    };
    const people =
      rangeText(locale, course?.people_min, course?.people_max) ??
      rangeText(locale, peopleOf((i) => i.people_min, Math.min), peopleOf((i) => i.people_max, Math.max));
    // 開くと出す文。区分（大人・子ども・年齢）のある料金は「大人 3,500 円」。区分が無くて人数だけ違う料金が複数あれば「人数 2〜4 名 3,000 円」
    const notes = unique(
      g.flatMap((it) => {
        const who = whoText(it, locale);
        const ppl = rangeText(locale, it.people_min, it.people_max);
        const money = amountText({ amount: it.amount, amountMax: it.amount_max, currency: it.currency }, locale);
        if (who) return [t.price.note(who, money)];
        if (g.length > 1 && ppl) return [t.price.note(t.price.people(ppl), money)];
        return [];
      }),
    );
    return {
      courseLabel: courseLabel(first.course),
      people,
      min: Math.min(...g.map((i) => i.amount)),
      max: Math.max(...g.map((i) => i.amount_max ?? i.amount)),
      currency: first.currency,
      perLabel: labelOf(PRICE_PER_LIST, first.per, locale),
      notes,
    };
  });

  const currencies = unique(items.map((i) => i.currency));
  const currency = currencies.length === 1 ? currencies[0] : null;
  const taxes = unique(items.map((i) => i.tax_included));
  const taxIncluded = taxes.length === 1 && taxes[0] !== undefined ? taxes[0] : null;
  const unit = currency === "JPY" ? a.price.yenUnit : currency;
  const tax = taxIncluded === true ? a.price.unitTaxIn : taxIncluded === false ? a.price.unitTaxOut : "";
  return {
    unitLabel: unit ? capitalize(`${tax.replace(/^[・ ·]+/, "")}${a.paren(unit)}`.trim()) : null,
    currency,
    taxIncluded,
    rows,
    officialUrl,
  };
}

// en の「tax incl.」は文頭だけ大文字にする。ja は変わらない
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
