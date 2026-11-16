// 温泉（日帰り温泉・外湯・足湯）：コアの表と詳細
import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, text, time, uuid } from "drizzle-orm/pg-core";
import { hotspringDetailsSchema } from "../../lib/hotspring/details.ts";
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
import { operators } from "./people.ts";

const KIND_LABELS = { day_use: "日帰り温泉", public_bath: "外湯", foot_bath: "足湯" };
const BATH_TYPE_LABELS = { indoor: "内湯", open_air: "露天", private: "貸切", other: "その他" };
const SPRING_HANDLING_LABELS = {
  free_flowing: "源泉かけ流し",
  circulated: "循環",
  heated: "加温",
  diluted: "加水",
  other: "その他",
};
const FEE_KIND_LABELS = { adult: "大人", child: "子ども", private: "貸切", other: "その他" };

export const hotsprings = pgTable(
  "hotsprings",
  {
    destId: uuid("dest_id")
      .primaryKey()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    operatorId: uuid("operator_id").references(() => operators.id, { onDelete: "set null" }),
    kind: text("kind"),
    ...locationColumns(),
    officialUrl: text("official_url"),
    /** 温泉の詳細（風呂・時間・料金・設備・アクセス・注意点）。型つき JSON。null は新しい形でまだ入っていない温泉 */
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [
    oneOf("hotsprings_kind_check", t.kind, Object.keys(KIND_LABELS)),
    geoPrecisionCheck("hotsprings", t),
    publishedRead(t.destId),
  ],
);

export const hotspringBaths = pgTable(
  "hotspring_baths",
  {
    ...destChildColumns(),
    bathType: text("bath_type"),
    springHandling: text("spring_handling"),
    springQuality: text("spring_quality"),
    note: localized("note"),
  },
  (t) => [
    index("hotspring_baths_dest_id_idx").on(t.destId),
    oneOf("hotspring_baths_bath_type_check", t.bathType, Object.keys(BATH_TYPE_LABELS)),
    oneOf("hotspring_baths_spring_handling_check", t.springHandling, Object.keys(SPRING_HANDLING_LABELS)),
    publishedRead(t.destId),
  ],
);

export const hotspringHours = pgTable(
  "hotspring_hours",
  {
    ...destChildColumns(),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
    closedDays: localized("closed_days"),
    note: localized("note"),
  },
  (t) => [index("hotspring_hours_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const hotspringFees = pgTable(
  "hotspring_fees",
  {
    ...destChildColumns(),
    feeKind: text("fee_kind"),
    amount: numeric("amount").notNull(),
    amountMax: numeric("amount_max"),
    currency: text("currency").notNull(),
    note: localized("note"),
  },
  (t) => [
    index("hotspring_fees_dest_id_idx").on(t.destId),
    oneOf("hotspring_fees_fee_kind_check", t.feeKind, Object.keys(FEE_KIND_LABELS)),
    currencyCheck("hotspring_fees", t),
    publishedRead(t.destId),
  ],
);

export const hotspringAmenities = pgTable(
  "hotspring_amenities",
  {
    ...destChildColumns(),
    towel: boolean("towel"),
    restArea: boolean("rest_area"),
    meal: boolean("meal"),
    note: localized("note"),
  },
  (t) => [index("hotspring_amenities_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const hotspringAccess = pgTable(
  "hotspring_access",
  {
    ...destChildColumns(),
    nearestStation: text("nearest_station"),
    parking: boolean("parking"),
    parkingCapacity: integer("parking_capacity"),
    note: localized("note"),
  },
  (t) => [index("hotspring_access_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const hotspringCautions = pgTable(
  "hotspring_cautions",
  {
    ...destChildColumns(),
    kind: text("kind"),
    note: localized("note"),
  },
  (t) => [index("hotspring_cautions_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const hotspringTexts = pgTable("hotspring_texts", { ...textsColumns() }, (t) => [
  primaryKey({ columns: [t.destId, t.lang] }),
  langCheck("hotspring_texts", t),
  publishedRead(t.destId),
]);

export const hotspringCore: CoreDef = {
  coreType: "hotspring",
  path: "hotsprings",
  label: "温泉",
  table: hotsprings,
  texts: hotspringTexts,
  columns: { kind: "種類", officialUrl: "公式 URL" },
  kindLabels: KIND_LABELS,
  // 詳細は details の JSON 1 つ。下の旧い詳細の表は、集め直しが済むまで残す（detailsSchema があれば取り込みは表を見ない）
  detailsSchema: hotspringDetailsSchema,
  details: [
    {
      key: "baths",
      table: hotspringBaths,
      label: "浴槽",
      columns: { bathType: "種類", springHandling: "源泉の扱い", springQuality: "泉質", note: "メモ" },
    },
    {
      key: "hours",
      table: hotspringHours,
      label: "営業時間",
      columns: { opensAt: "開く時刻", closesAt: "閉まる時刻", closedDays: "休みの日", note: "メモ" },
    },
    {
      key: "fees",
      table: hotspringFees,
      label: "料金",
      columns: { feeKind: "区分", amount: "金額", amountMax: "金額（上限）", currency: "通貨", note: "メモ" },
    },
    {
      key: "amenities",
      table: hotspringAmenities,
      label: "設備",
      columns: { towel: "タオル", restArea: "休憩所", meal: "食事", note: "メモ" },
    },
    {
      key: "access",
      table: hotspringAccess,
      label: "アクセス",
      columns: { nearestStation: "最寄り駅", parking: "駐車場", parkingCapacity: "台数", note: "メモ" },
    },
    {
      key: "cautions",
      table: hotspringCautions,
      label: "注意点",
      columns: { kind: "種類", note: "内容" },
    },
  ],
};
