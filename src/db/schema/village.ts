// 村・町並み（温泉街・宿場町・漁村など）。operator_id は持たない
import { index, integer, jsonb, pgTable, primaryKey, text, time, uuid } from "drizzle-orm/pg-core";
import { villageDetailsSchema } from "../../lib/village/details.ts";
import {
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
  onsen_town: "温泉街",
  post_town: "宿場町",
  fishing_village: "漁村",
  temple_town: "門前町",
  castle_town: "城下町",
};

export const villages = pgTable(
  "villages",
  {
    destId: uuid("dest_id")
      .primaryKey()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    kind: text("kind"),
    ...locationColumns(),
    /** まちの詳細（歩き方・店の時間・催し・アクセス・注意点）。型つき JSON。null は新しい形でまだ入っていないまち */
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [oneOf("villages_kind_check", t.kind, Object.keys(KIND_LABELS)), geoPrecisionCheck("villages", t), publishedRead(t.destId)],
);

/** 巡る範囲・所要時間 */
export const villageWalks = pgTable(
  "village_walks",
  {
    ...destChildColumns(),
    area: localized("area"),
    durationMin: integer("duration_min"),
  },
  (t) => [index("village_walks_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

/** 店が開いている時間帯 */
export const villageShopHours = pgTable(
  "village_shop_hours",
  {
    ...destChildColumns(),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
    note: localized("note"),
  },
  (t) => [index("village_shop_hours_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

/** アクセス・駐車場 */
export const villageAccess = pgTable(
  "village_access",
  {
    ...destChildColumns(),
    kind: text("kind"),
    note: localized("note"),
  },
  (t) => [
    index("village_access_dest_id_idx").on(t.destId),
    oneOf("village_access_kind_check", t.kind, ["station", "bus", "car", "parking", "walk", "other"]),
    publishedRead(t.destId),
  ],
);

/** 祭り・イベントと時期 */
export const villageEvents = pgTable(
  "village_events",
  {
    ...destChildColumns(),
    name: localized("name"),
    season: text("season"),
    note: localized("note"),
  },
  (t) => [index("village_events_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const villageCautions = pgTable(
  "village_cautions",
  {
    ...destChildColumns(),
    kind: text("kind"),
    note: localized("note"),
  },
  (t) => [index("village_cautions_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const villageTexts = pgTable(
  "village_texts",
  { ...textsColumns() },
  (t) => [primaryKey({ columns: [t.destId, t.lang] }), langCheck("village_texts", t), publishedRead(t.destId)],
);

export const villageCore: CoreDef = {
  coreType: "village",
  path: "villages",
  label: "村",
  table: villages,
  texts: villageTexts,
  columns: { kind: "種類", regionId: "地域", municipality: "市区町村" },
  kindLabels: KIND_LABELS,
  // 詳細は details の JSON 1 つ。下の旧い詳細の表は、集め直しが済むまで残す（detailsSchema があれば取り込みは表を見ない）
  detailsSchema: villageDetailsSchema,
  details: [
    { key: "walks", table: villageWalks, label: "巡る範囲", columns: { area: "範囲", durationMin: "所要時間（分）" } },
    { key: "shop_hours", table: villageShopHours, label: "店の時間", columns: { opensAt: "開店", closesAt: "閉店", note: "メモ" } },
    { key: "access", table: villageAccess, label: "アクセス", columns: { kind: "種類", note: "メモ" } },
    { key: "events", table: villageEvents, label: "祭り・イベント", columns: { name: "名前", season: "時期", note: "メモ" } },
    { key: "cautions", table: villageCautions, label: "注意点", columns: { kind: "種類", note: "メモ" } },
  ],
};
