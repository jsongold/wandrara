// 温泉（日帰り温泉・外湯・足湯）：コアの表と詳細
import { jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { hotspringDetailsSchema } from "../../lib/hotspring/details.ts";
import {
  geoPrecisionCheck,
  locationColumns,
  oneOf,
  publishedRead,
  textsColumns,
  type CoreDef,
} from "./_shared.ts";
import { destinations } from "./common.ts";
import { operators } from "./people.ts";

const KIND_LABELS = { day_use: "日帰り温泉", public_bath: "外湯", foot_bath: "足湯" };

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

export const hotspringTexts = pgTable("hotspring_texts", { ...textsColumns() }, (t) => [
  primaryKey({ columns: [t.destId, t.lang] }),
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
  // 詳細は details の JSON 1 つ
  detailsSchema: hotspringDetailsSchema,
  details: [],
};
