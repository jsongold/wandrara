// 体験：ツアー・ワークショップ・試飲など。詳細は experiences.details（JSON）に持つ
import { boolean, integer, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { experienceDetailsSchema } from "../../lib/experience/details.ts";
import { destinations } from "./common.ts";
import { regions } from "./dictionary.ts";
import { operators } from "./people.ts";
import {
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
    /** 体験の詳細（コース・料金・開催・場所 など）。型つき JSON。null は新しい形でまだ入っていない体験 */
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [oneOf("experiences_kind_check", t.kind, Object.keys(KIND_LABELS)), publishedRead(t.destId)],
);

export const experienceTexts = pgTable(
  "experience_texts",
  { ...textsColumns() },
  (t) => [primaryKey({ columns: [t.destId, t.lang] }), publishedRead(t.destId)],
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
  // 詳細は details の JSON 1 つ
  detailsSchema: experienceDetailsSchema,
  details: [],
};
