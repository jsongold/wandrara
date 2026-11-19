// コアの表の書き方（building.ts の例。名前は snake_case の文字列で渡す。RLS はポリシーを付けると有効になる）
//   const KIND_LABELS = { museum: "美術館・博物館", shrine: "神社" };
//   export const buildings = pgTable("buildings", {
//     destId: uuid("dest_id").primaryKey().references(() => destinations.destId, { onDelete: "cascade" }),
//     kind: text("kind"), officialUrl: text("official_url"),
//   }, (t) => [oneOf("buildings_kind_check", t.kind, Object.keys(KIND_LABELS)), publishedRead(t.destId)]);
//   export const buildingHours = pgTable("building_hours", {
//     ...destChildColumns(), openTime: time("open_time"), note: localized("note"),
//   }, (t) => [index("building_hours_dest_id_idx").on(t.destId), publishedRead(t.destId)]);
//   入れ子にするなら：parentId: uuid("parent_id").notNull().references(() => 親の表.id, { onDelete: "cascade" }) と、details に parent: { key, column } を付ける
//   export const buildingTexts = pgTable("building_texts", { ...textsColumns() },
//     (t) => [primaryKey({ columns: [t.destId, t.lang] }), publishedRead(t.destId)]);
//   export const buildingCore: CoreDef = { coreType: "building", path: "buildings", label: "建物",
//     table: buildings, texts: buildingTexts, columns: { kind: "種類" }, kindLabels: KIND_LABELS,
//     details: [{ key: "hours", table: buildingHours, label: "開館時間", columns: { openTime: "開く時刻" } }] };
import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  integer,
  jsonb,
  pgPolicy,
  text,
  uuid,
  type PgColumn,
  type PgTable,
} from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole } from "drizzle-orm/supabase";
import type { z } from "zod";
import { destinations } from "./common.ts";
import { languages, regions } from "./dictionary.ts";

export type { LocalizedText } from "../../lib/i18n/localized.ts";
import type { LocalizedText } from "../../lib/i18n/localized.ts";

export const CORE_TYPES = ["accommodation", "experience", "nature", "village", "building", "hotspring"] as const;
export type CoreType = (typeof CORE_TYPES)[number];

export const GEO_PRECISIONS = ["exact", "street", "district", "municipality"] as const;

/** 詳細の行の中の文（注意点・メモなど）。jsonb の LocalizedText */
export function localized(name: string) {
  return jsonb(name).$type<LocalizedText>();
}

/** 位置を持つコアの列。geo_precision の check は geoPrecisionCheck で付ける */
export function locationColumns() {
  return {
    regionId: text("region_id").references(() => regions.id),
    prefecture: text("prefecture"),
    municipality: text("municipality"),
    district: text("district"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    geoPrecision: text("geo_precision"),
  };
}

/** 詳細の表の先頭の列（id・dest_id・sort）。dest_id の index は表ごとに付ける */
export function destChildColumns() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    destId: uuid("dest_id")
      .notNull()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    sort: integer("sort").notNull().default(0),
  };
}

/** <core>_texts の列。主キー (dest_id, lang) は表ごとに付ける。lang は languages 表を指す。コアによって列を足してよい */
export function textsColumns() {
  return {
    destId: uuid("dest_id")
      .notNull()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    lang: text("lang")
      .notNull()
      .references(() => languages.tag, { onDelete: "restrict" }),
    name: text("name").notNull(),
    summary: text("summary"),
    address: text("address"),
  };
}

/** コンテンツの表の public read（公開中の dest だけ）。public.is_published は m1 の SQL で作る */
export function publishedRead(destId: PgColumn) {
  return pgPolicy("public read", {
    for: "select",
    to: [anonRole, authenticatedRole],
    using: sql`public.is_published(${destId})`,
  });
}

/** column が values のどれか（NULL は通す）。kind などの check に使う。name は "<表>_<列>_check" */
export function oneOf(name: string, column: PgColumn, values: readonly string[]) {
  for (const v of values) {
    if (!/^[a-z0-9_]+$/.test(v)) throw new Error(`oneOf(${name}): 値は英小文字のスネークケース: ${v}`);
  }
  return check(name, sql`${column} in (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`);
}

/** locationColumns の geo_precision の check */
export function geoPrecisionCheck(tableName: string, t: { geoPrecision: PgColumn }) {
  return oneOf(`${tableName}_geo_precision_check`, t.geoPrecision, GEO_PRECISIONS);
}

/** 料金の currency の check（英大文字 3 文字） */
export function currencyCheck(tableName: string, t: { currency: PgColumn }) {
  return check(`${tableName}_currency_check`, sql`${t.currency} ~ '^[A-Z]{3}$'`);
}

export type DetailDef = {
  /** bundle と API での名前（例 "courses"、"prices"） */
  key: string;
  /** 詳細の表 */
  table: PgTable;
  /** 詳細の画面の見出し（日本語） */
  label: string;
  /** 画面に出す列（TS のプロパティ名 → 日本語のラベル） */
  columns: Record<string, string>;
  /** 入れ子なら親の key と、親を指す列（TS のプロパティ名、例 "courseId"） */
  parent?: { key: string; column: string };
};

export type CoreDef = {
  coreType: CoreType;
  /** API のパス（"accommodations"） */
  path: string;
  /** 「宿」など */
  label: string;
  /** コアの表 */
  table: PgTable;
  /** <core>_texts */
  texts: PgTable;
  /** コアの列で画面に出すもの（TS のプロパティ名 → 日本語のラベル） */
  columns: Record<string, string>;
  /** kind の値 → 日本語（例 private_rental → 一棟貸し） */
  kindLabels: Record<string, string>;
  /** 親が先、子が後の順 */
  details: DetailDef[];
  /** あるコアは details を JSON 1 つで受け、コアの行の details 列に書く。詳細の表は読み書きしない */
  detailsSchema?: z.ZodType;
};
