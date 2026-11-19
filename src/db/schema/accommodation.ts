// コア accommodation（宿）の表。詳細は accommodations.details（JSON）に持つ
import { jsonb, pgTable, primaryKey, text, time, uuid } from "drizzle-orm/pg-core";
import { geoPrecisionCheck, locationColumns, oneOf, publishedRead, textsColumns, type CoreDef } from "./_shared.ts";
import { accommodationDetailsSchema } from "../../lib/accommodation/schema.ts";
import { destinations } from "./common.ts";
import { operators } from "./people.ts";

const KIND_LABELS = {
  hotel: "ホテル",
  ryokan: "旅館",
  private_rental: "一棟貸し",
  minshuku: "民宿",
  pension: "ペンション",
  glamping: "グランピング",
  campsite: "キャンプ場",
};

export const accommodations = pgTable(
  "accommodations",
  {
    destId: uuid("dest_id")
      .primaryKey()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    operatorId: uuid("operator_id").references(() => operators.id, { onDelete: "set null" }),
    kind: text("kind"),
    ...locationColumns(),
    checkIn: time("check_in"),
    checkOut: time("check_out"),
    officialUrl: text("official_url"),
    /** 宿の詳細（部屋・風呂・食事・料金・設備 など）。型つき JSON（docs/data-model.md 2 章）。null は新しい形でまだ入っていない宿 */
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [oneOf("accommodations_kind_check", t.kind, Object.keys(KIND_LABELS)), geoPrecisionCheck("accommodations", t), publishedRead(t.destId)],
);

export const accommodationTexts = pgTable(
  "accommodation_texts",
  { ...textsColumns() },
  (t) => [primaryKey({ columns: [t.destId, t.lang] }), publishedRead(t.destId)],
);

export const accommodationCore: CoreDef = {
  coreType: "accommodation",
  path: "accommodations",
  label: "宿",
  table: accommodations,
  texts: accommodationTexts,
  columns: { kind: "種類", checkIn: "チェックイン", checkOut: "チェックアウト", officialUrl: "公式 URL" },
  kindLabels: KIND_LABELS,
  // 詳細は details の JSON 1 つ（accommodations.details）。詳細の表は持たない
  detailsSchema: accommodationDetailsSchema,
  details: [],
};
