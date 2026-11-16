// 村・町並み（温泉街・宿場町・漁村など）。operator_id は持たない
import { jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { villageDetailsSchema } from "../../lib/village/details.ts";
import {
  geoPrecisionCheck,
  langCheck,
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
  // 詳細は details の JSON 1 つ
  detailsSchema: villageDetailsSchema,
  details: [],
};
