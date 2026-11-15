// 体験：ツアー・ワークショップ・試飲など。位置はコアに持たず experience_locations に持つ（region_id だけコアに持つ）
import { boolean, doublePrecision, index, integer, numeric, pgTable, primaryKey, text, time, uuid } from "drizzle-orm/pg-core";
import { destinations } from "./common.ts";
import { regions } from "./dictionary.ts";
import { operators } from "./people.ts";
import {
  currencyCheck,
  destChildColumns,
  geoPrecisionCheck,
  langCheck,
  localized,
  oneOf,
  publishedRead,
  textsColumns,
  type CoreDef,
} from "./_shared.ts";

const KIND_LABELS = {
  tour: "ツアー",
  workshop: "ワークショップ",
  tasting: "試飲・試食",
  activity: "アクティビティ",
  facility_use: "施設の利用",
  event: "イベント",
};
const LOCATION_KIND_LABELS = { meeting: "集合場所", activity: "実施場所" };
const PRICE_UNIT_LABELS = { per_person: "1人", per_group: "1グループ", per_time: "1回" };
const AUDIENCE_LABELS = { all: "全員", adult: "大人", child: "子ども" };
const INCLUSION_KIND_LABELS = { included: "含まれるもの", excluded: "含まれないもの", bring: "持ち物" };

export const experiences = pgTable(
  "experiences",
  {
    destId: uuid("dest_id")
      .primaryKey()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    operatorId: uuid("operator_id").references(() => operators.id, { onDelete: "set null" }),
    kind: text("kind"),
    regionId: text("region_id").references(() => regions.id),
    durationMinutes: integer("duration_minutes"),
    reservationRequired: boolean("reservation_required"),
    officialUrl: text("official_url"),
  },
  (t) => [oneOf("experiences_kind_check", t.kind, Object.keys(KIND_LABELS)), publishedRead(t.destId)],
);

export const experienceCourses = pgTable(
  "experience_courses",
  {
    ...destChildColumns(),
    name: localized("name"),
    description: localized("description"),
    durationMinutes: integer("duration_minutes"),
    minPeople: integer("min_people"),
    maxPeople: integer("max_people"),
    minAge: integer("min_age"),
    languages: text("languages").array(),
  },
  (t) => [index("experience_courses_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const experiencePrices = pgTable(
  "experience_prices",
  {
    ...destChildColumns(),
    courseId: uuid("course_id").references(() => experienceCourses.id, { onDelete: "cascade" }),
    unit: text("unit"),
    audience: text("audience"),
    amount: numeric("amount").notNull(),
    amountMax: numeric("amount_max"),
    currency: text("currency").notNull(),
    note: localized("note"),
  },
  (t) => [
    index("experience_prices_dest_id_idx").on(t.destId),
    oneOf("experience_prices_unit_check", t.unit, Object.keys(PRICE_UNIT_LABELS)),
    oneOf("experience_prices_audience_check", t.audience, Object.keys(AUDIENCE_LABELS)),
    currencyCheck("experience_prices", t),
    publishedRead(t.destId),
  ],
);

export const experienceSchedules = pgTable(
  "experience_schedules",
  {
    ...destChildColumns(),
    startMonth: integer("start_month"),
    endMonth: integer("end_month"),
    weekdays: integer("weekdays").array(), // 1=月 ... 7=日
    startTime: time("start_time"),
    endTime: time("end_time"),
    rainPolicy: localized("rain_policy"),
  },
  (t) => [index("experience_schedules_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const experienceLocations = pgTable(
  "experience_locations",
  {
    ...destChildColumns(),
    kind: text("kind"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    geoPrecision: text("geo_precision"),
    address: localized("address"),
  },
  (t) => [
    index("experience_locations_dest_id_idx").on(t.destId),
    oneOf("experience_locations_kind_check", t.kind, Object.keys(LOCATION_KIND_LABELS)),
    geoPrecisionCheck("experience_locations", t),
    publishedRead(t.destId),
  ],
);

export const experienceInclusions = pgTable(
  "experience_inclusions",
  {
    ...destChildColumns(),
    kind: text("kind"),
    item: localized("item"),
  },
  (t) => [
    index("experience_inclusions_dest_id_idx").on(t.destId),
    oneOf("experience_inclusions_kind_check", t.kind, Object.keys(INCLUSION_KIND_LABELS)),
    publishedRead(t.destId),
  ],
);

export const experienceCautions = pgTable(
  "experience_cautions",
  {
    ...destChildColumns(),
    kind: text("kind"),
    note: localized("note"),
  },
  (t) => [index("experience_cautions_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const experienceBookingLinks = pgTable(
  "experience_booking_links",
  {
    ...destChildColumns(),
    label: text("label"),
    url: text("url").notNull(),
    isOfficial: boolean("is_official"),
  },
  (t) => [index("experience_booking_links_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const experienceTexts = pgTable(
  "experience_texts",
  { ...textsColumns() },
  (t) => [primaryKey({ columns: [t.destId, t.lang] }), langCheck("experience_texts", t), publishedRead(t.destId)],
);

export const experienceCore: CoreDef = {
  coreType: "experience",
  path: "experiences",
  label: "体験",
  table: experiences,
  texts: experienceTexts,
  columns: {
    kind: "種類",
    regionId: "地域",
    durationMinutes: "所要時間（分）",
    reservationRequired: "要予約",
    officialUrl: "公式サイト",
  },
  kindLabels: KIND_LABELS,
  details: [
    {
      key: "courses",
      table: experienceCourses,
      label: "コース",
      columns: {
        name: "名前",
        description: "内容",
        durationMinutes: "時間（分）",
        minPeople: "最少人数",
        maxPeople: "最大人数",
        minAge: "最低年齢",
        languages: "案内の言語",
      },
    },
    {
      key: "prices",
      table: experiencePrices,
      label: "料金",
      columns: {
        courseId: "コース",
        unit: "単位",
        audience: "対象",
        amount: "金額",
        amountMax: "金額（上限）",
        currency: "通貨",
        note: "備考",
      },
    },
    {
      key: "schedules",
      table: experienceSchedules,
      label: "開催日時",
      columns: {
        startMonth: "開始月",
        endMonth: "終了月",
        weekdays: "曜日",
        startTime: "開始時刻",
        endTime: "終了時刻",
        rainPolicy: "雨天時",
      },
    },
    {
      key: "locations",
      table: experienceLocations,
      label: "場所",
      columns: { kind: "区分", lat: "緯度", lng: "経度", geoPrecision: "位置の精度", address: "住所" },
    },
    { key: "inclusions", table: experienceInclusions, label: "含まれるもの", columns: { kind: "区分", item: "内容" } },
    { key: "cautions", table: experienceCautions, label: "注意点", columns: { kind: "種類", note: "内容" } },
    {
      key: "booking_links",
      table: experienceBookingLinks,
      label: "予約先",
      columns: { label: "名前", url: "URL", isOfficial: "公式" },
    },
  ],
};
