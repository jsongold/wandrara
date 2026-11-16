// 自然のコア：natures・texts。詳細は natures.details（JSON）に持つ。operator_id は持たない
import { jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { natureDetailsSchema } from "../../lib/nature/details.ts";
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
    /** 自然の詳細（見頃・時間と料金・アクセス・道・規制 など）。型つき JSON。null は新しい形でまだ入っていない自然 */
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [
    oneOf("natures_kind_check", t.kind, Object.keys(KIND_LABELS)),
    oneOf("natures_protection_check", t.protection, Object.keys(PROTECTION_LABELS)),
    geoPrecisionCheck("natures", t),
    publishedRead(t.destId),
  ],
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
  // 詳細は details の JSON 1 つ
  detailsSchema: natureDetailsSchema,
  details: [],
};
