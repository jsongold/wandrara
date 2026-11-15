// 自然のコア：natures と詳細（見頃・時間と料金・アクセス・トレイル・立入規制・注意点）・texts。operator_id は持たない
import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgTable, primaryKey, text, time, uuid } from "drizzle-orm/pg-core";
import {
  currencyCheck,
  destChildColumns,
  geoPrecisionCheck,
  langCheck,
  localized,
  locationColumns,
  oneOf,
  publishedRead,
  textsColumns,
  type CoreDef,
} from "./_shared.ts";
import { destinations } from "./common.ts";

const KIND_LABELS = {
  coast: "海岸",
  mountain: "山",
  lake: "湖",
  highland: "高原",
  gorge: "渓谷",
  waterfall: "滝",
  forest: "森",
  volcano: "火山",
};
const PROTECTION_LABELS = {
  national_park: "国立公園",
  quasi_national_park: "国定公園",
  prefectural_park: "県立自然公園",
  geopark: "ジオパーク",
  none: "指定なし",
};
const DIFFICULTY_LABELS = { easy: "易しい", moderate: "普通", hard: "難しい" };
const RESTRICTION_KIND_LABELS = { closure: "立入禁止", volcanic_gas: "火山ガス警戒", other: "その他" };

export const natures = pgTable(
  "natures",
  {
    destId: uuid("dest_id")
      .primaryKey()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    kind: text("kind"),
    ...locationColumns(),
    /** 保護の区分 */
    protection: text("protection"),
  },
  (t) => [
    oneOf("natures_kind_check", t.kind, Object.keys(KIND_LABELS)),
    oneOf("natures_protection_check", t.protection, Object.keys(PROTECTION_LABELS)),
    geoPrecisionCheck("natures", t),
    publishedRead(t.destId),
  ],
);

/** 見頃（何が・いつ） */
export const natureSeasons = pgTable(
  "nature_seasons",
  {
    ...destChildColumns(),
    subject: localized("subject"),
    monthFrom: integer("month_from"),
    monthTo: integer("month_to"),
  },
  (t) => [
    index("nature_seasons_dest_id_idx").on(t.destId),
    check("nature_seasons_month_from_check", sql`${t.monthFrom} between 1 and 12`),
    check("nature_seasons_month_to_check", sql`${t.monthTo} between 1 and 12`),
    publishedRead(t.destId),
  ],
);

/** 入れる時間・入場料（NULL＝不明。無料は amount 0） */
export const natureHoursFees = pgTable(
  "nature_hours_fees",
  {
    ...destChildColumns(),
    openTime: time("open_time"),
    closeTime: time("close_time"),
    closedNote: localized("closed_note"),
    amount: numeric("amount"),
    amountMax: numeric("amount_max"),
    currency: text("currency"),
  },
  (t) => [index("nature_hours_fees_dest_id_idx").on(t.destId), currencyCheck("nature_hours_fees", t), publishedRead(t.destId)],
);

/** 駐車場・最寄り駅・徒歩の時間 */
export const natureAccess = pgTable(
  "nature_access",
  {
    ...destChildColumns(),
    hasParking: boolean("has_parking"),
    parkingNote: localized("parking_note"),
    nearestStation: text("nearest_station"),
    walkMinutes: integer("walk_minutes"),
  },
  (t) => [index("nature_access_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

/** トレイル：距離・高低差・難しさ・所要時間 */
export const natureTrails = pgTable(
  "nature_trails",
  {
    ...destChildColumns(),
    name: localized("name"),
    distanceKm: numeric("distance_km"),
    elevationGainM: integer("elevation_gain_m"),
    difficulty: text("difficulty"),
    durationMinutes: integer("duration_minutes"),
  },
  (t) => [
    index("nature_trails_dest_id_idx").on(t.destId),
    oneOf("nature_trails_difficulty_check", t.difficulty, Object.keys(DIFFICULTY_LABELS)),
    publishedRead(t.destId),
  ],
);

/** 立入規制・火山ガスの警戒・期間 */
export const natureRestrictions = pgTable(
  "nature_restrictions",
  {
    ...destChildColumns(),
    kind: text("kind"),
    note: localized("note"),
    dateFrom: date("date_from"),
    dateTo: date("date_to"),
  },
  (t) => [
    index("nature_restrictions_dest_id_idx").on(t.destId),
    oneOf("nature_restrictions_kind_check", t.kind, Object.keys(RESTRICTION_KIND_LABELS)),
    publishedRead(t.destId),
  ],
);

export const natureCautions = pgTable(
  "nature_cautions",
  {
    ...destChildColumns(),
    kind: text("kind"),
    note: localized("note"),
  },
  (t) => [index("nature_cautions_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const natureTexts = pgTable(
  "nature_texts",
  { ...textsColumns() },
  (t) => [primaryKey({ columns: [t.destId, t.lang] }), langCheck("nature_texts", t), publishedRead(t.destId)],
);

export const natureCore: CoreDef = {
  coreType: "nature",
  path: "natures",
  label: "自然",
  table: natures,
  texts: natureTexts,
  columns: { kind: "種類", protection: "保護の区分" },
  kindLabels: KIND_LABELS,
  details: [
    { key: "seasons", table: natureSeasons, label: "見頃", columns: { subject: "何が", monthFrom: "開始月", monthTo: "終了月" } },
    {
      key: "hours_fees",
      table: natureHoursFees,
      label: "時間と料金",
      columns: { openTime: "開く時間", closeTime: "閉じる時間", closedNote: "休み", amount: "料金", currency: "通貨" },
    },
    {
      key: "access",
      table: natureAccess,
      label: "アクセス",
      columns: { hasParking: "駐車場", parkingNote: "駐車場のメモ", nearestStation: "最寄り駅", walkMinutes: "徒歩（分）" },
    },
    {
      key: "trails",
      table: natureTrails,
      label: "トレイル",
      columns: { name: "名前", distanceKm: "距離（km）", elevationGainM: "高低差（m）", difficulty: "難しさ", durationMinutes: "所要時間（分）" },
    },
    {
      key: "restrictions",
      table: natureRestrictions,
      label: "立入規制",
      columns: { kind: "種類", note: "内容", dateFrom: "開始", dateTo: "終了" },
    },
    { key: "cautions", table: natureCautions, label: "注意点", columns: { kind: "種類", note: "内容" } },
  ],
};
