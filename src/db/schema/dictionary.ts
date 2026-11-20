// 辞書：地域と分類。誰でも読める
import { sql } from "drizzle-orm";
import { check, doublePrecision, foreignKey, integer, jsonb, pgPolicy, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole } from "drizzle-orm/supabase";
import type { LocalizedText } from "./_shared.ts";

const anyoneRead = () =>
  pgPolicy("anyone read", { for: "select", to: [anonRole, authenticatedRole], using: sql`true` });

// 言語：訳文を持てる言語の正本。足すのは 1 行の insert（デプロイは要らない）。使われている言語は外部キー（restrict）で消せない
// 画面の言語（src/lib/i18n/locale.ts の LOCALES）はこの一部で、別に持つ。形は src/lib/i18n/localized.ts の LANGUAGE_TAG_PATTERN と同じ
export const languages = pgTable(
  "languages",
  {
    tag: text("tag").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("languages_tag_check", sql`${t.tag} ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$'`),
    anyoneRead(),
  ],
);

export const regions = pgTable(
  "regions",
  {
    id: text("id").primaryKey(),
    parentId: text("parent_id"),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    municipalityCode: text("municipality_code"), // 使わない（エリアの材料は region_parts）。後で消す
    sort: integer("sort"),
    // 区画の無いエリア（大涌谷など）の位置。地図に点で出す
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
  },
  (t) => [
    foreignKey({ name: "regions_parent_id_fkey", columns: [t.parentId], foreignColumns: [t.id] }),
    check("regions_id_check", sql`${t.id} ~ '^[a-z0-9-]{1,40}$'`),
    anyoneRead(),
  ],
);

// エリアの材料：どの市区町村（N03）・町丁字（e-Stat）でできているか。1 コード 1 行。地図の形と位置からのエリア決定はここから作る
export const REGION_PART_SOURCES = ["n03", "estat"] as const;

export const regionParts = pgTable(
  "region_parts",
  {
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // n03：市区町村コード（N03_007）、estat：小地域の KEY_CODE
    sourceVersion: text("source_version").notNull(), // 例 N03-2024、estat-2020
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "region_parts_pkey", columns: [t.source, t.sourceVersion, t.code] }),
    check("region_parts_source_check", sql`${t.source} in ('n03', 'estat')`),
    anyoneRead(),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    parentId: text("parent_id"),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    icon: text("icon").notNull().default("tag"),
    sort: integer("sort"),
  },
  (t) => [
    foreignKey({ name: "categories_parent_id_fkey", columns: [t.parentId], foreignColumns: [t.id] }),
    anyoneRead(),
  ],
);

// エリアの特性（温泉・海辺など）のマスター。地図で「この特性があるエリア」に絞るのに使う
// source = items：公開中の宿・体験の分類（category_ids のどれか）から数える。geo：土地から計算した値を region_traits に入れる（今は行なし）
// 特性の定義は docs/suggest/trait-candidates.tsv（src/generated/trait-taxonomy.json）。dest ごとの値は dest_traits
// source（作り方）= text：紹介文から判定・location：位置から計算・external：外部データ・column：列から・calc：ほかの値から計算
// value_type = flag（1）・number（unit に単位）・level（0〜3）・enum
export const TRAIT_VALUE_TYPES = ["flag", "number", "level", "enum"] as const;
export const TRAIT_SOURCES = ["items", "geo", "text", "location", "external", "column", "calc"] as const;

export const traits = pgTable(
  "traits",
  {
    id: text("id").primaryKey(),
    name: jsonb("name").$type<LocalizedText>().notNull(),
    icon: text("icon").notNull().default("tag"),
    sort: integer("sort"),
    valueType: text("value_type").notNull().default("flag"),
    unit: text("unit"), // number のとき（例 m）
    steps: jsonb("steps").$type<number[]>(), // number の絞り込みの段階（例 [300, 800]）
    source: text("source").notNull(),
    categoryIds: text("category_ids").array(), // source = items のとき、数える分類
    method: text("method"), // source = geo のときの計算方法の名前（例 coast・elevation_mean）
    // 定義表（trait-candidates.tsv）の列。items・geo の古い行では null
    big: text("big"), // 大分類（例 立地）
    sub: text("sub"), // 分類（例 水辺）
    target: text("target"), // 対象（全部・宿・体験・自然 など）
    reference: text("reference"), // 参考（OSM など、作り方の出どころ）
    fit: text("fit"), // 2 周目との相性（◎ ○ △）
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("traits_id_check", sql`${t.id} ~ '^[a-z0-9_-]{1,40}$'`),
    check("traits_value_type_check", sql`${t.valueType} in ('flag', 'number', 'level', 'enum')`),
    check("traits_source_check", sql`${t.source} in ('items', 'geo', 'text', 'location', 'external', 'column', 'calc')`),
    anyoneRead(),
  ],
);

// 土地から計算した特性の値（エリア × 特性）。flag は 1
export const regionTraits = pgTable(
  "region_traits",
  {
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
    traitId: text("trait_id")
      .notNull()
      .references(() => traits.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    sourceVersion: text("source_version").notNull(), // 例 N03-2024
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "region_traits_pkey", columns: [t.regionId, t.traitId] }), anyoneRead()],
);
