import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, time, uuid } from "drizzle-orm/pg-core";
import { buildingDetailsSchema } from "../../lib/building/details.ts";
import { destinations } from "./common.ts";
import { operators } from "./people.ts";
import {
  currencyCheck,
  destChildColumns,
  geoPrecisionCheck,
  langCheck,
  locationColumns,
  localized,
  oneOf,
  publishedRead,
  textsColumns,
  type CoreDef,
} from "./_shared.ts";

export const BUILDING_KIND_LABELS: Record<string, string> = {
  museum: "美術館・博物館",
  shrine: "神社",
  temple: "寺",
  castle: "城",
  observatory: "展望台",
  historic_building: "歴史的建造物",
};

export const buildings = pgTable(
  "buildings",
  {
    destId: uuid("dest_id")
      .primaryKey()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    operatorId: uuid("operator_id").references(() => operators.id, { onDelete: "set null" }),
    kind: text("kind"),
    ...locationColumns(),
    officialUrl: text("official_url"),
    /** 建物の詳細（時間・料金・催し・アクセス・注意点 など）。型つき JSON。null は新しい形でまだ入っていない建物 */
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [oneOf("buildings_kind_check", t.kind, Object.keys(BUILDING_KIND_LABELS)), geoPrecisionCheck("buildings", t), publishedRead(t.destId)],
);

export const buildingHours = pgTable(
  "building_hours",
  {
    ...destChildColumns(),
    openTime: time("open_time"),
    closeTime: time("close_time"),
    closedDays: localized("closed_days"),
    note: localized("note"),
  },
  (t) => [index("building_hours_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const buildingFees = pgTable(
  "building_fees",
  {
    ...destChildColumns(),
    label: localized("label"),
    amount: numeric("amount").notNull(),
    amountMax: numeric("amount_max"),
    currency: text("currency").notNull(),
    note: localized("note"),
  },
  (t) => [index("building_fees_dest_id_idx").on(t.destId), currencyCheck("building_fees", t), publishedRead(t.destId)],
);

export const buildingAccess = pgTable(
  "building_access",
  {
    ...destChildColumns(),
    howToGet: localized("how_to_get"),
    hasParking: boolean("has_parking"),
    parkingCapacity: integer("parking_capacity"),
    parkingNote: localized("parking_note"),
  },
  (t) => [index("building_access_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const buildingEvents = pgTable(
  "building_events",
  {
    ...destChildColumns(),
    name: localized("name"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    season: localized("season"),
    note: localized("note"),
  },
  (t) => [index("building_events_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const buildingCautions = pgTable(
  "building_cautions",
  {
    ...destChildColumns(),
    kind: text("kind"),
    note: localized("note"),
  },
  (t) => [index("building_cautions_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const buildingTexts = pgTable(
  "building_texts",
  { ...textsColumns() },
  (t) => [primaryKey({ columns: [t.destId, t.lang] }), langCheck("building_texts", t), publishedRead(t.destId)],
);

export const buildingCore: CoreDef = {
  coreType: "building",
  path: "buildings",
  label: "建物",
  table: buildings,
  texts: buildingTexts,
  columns: { kind: "種類", officialUrl: "公式 URL" },
  kindLabels: BUILDING_KIND_LABELS,
  // 詳細は details の JSON 1 つ。下の旧い詳細の表は、集め直しが済むまで残す（detailsSchema があれば取り込みは表を見ない）
  detailsSchema: buildingDetailsSchema,
  details: [
    { key: "hours", table: buildingHours, label: "開館時間", columns: { openTime: "開く時刻", closeTime: "閉まる時刻", closedDays: "休みの日", note: "メモ" } },
    { key: "fees", table: buildingFees, label: "入館料・拝観料", columns: { label: "区分", amount: "料金", amountMax: "料金（上限）", currency: "通貨", note: "メモ" } },
    { key: "access", table: buildingAccess, label: "アクセス", columns: { howToGet: "行き方", hasParking: "駐車場あり", parkingCapacity: "駐車台数", parkingNote: "駐車場のメモ" } },
    { key: "events", table: buildingEvents, label: "企画展・祭事", columns: { name: "名前", startDate: "開始日", endDate: "終了日", season: "時期", note: "メモ" } },
    { key: "cautions", table: buildingCautions, label: "注意点", columns: { kind: "種類", note: "内容" } },
  ],
};
