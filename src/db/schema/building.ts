import { jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { buildingDetailsSchema } from "../../lib/building/details.ts";
import { destinations } from "./common.ts";
import { operators } from "./people.ts";
import {
  geoPrecisionCheck,
  langCheck,
  locationColumns,
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
  // 詳細は details の JSON 1 つ
  detailsSchema: buildingDetailsSchema,
  details: [],
};
