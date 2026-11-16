// 辞書：地域と分類。誰でも読める
import { sql } from "drizzle-orm";
import { check, doublePrecision, foreignKey, integer, jsonb, pgPolicy, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole } from "drizzle-orm/supabase";
import type { LocalizedText } from "./_shared.ts";

const anyoneRead = () =>
  pgPolicy("anyone read", { for: "select", to: [anonRole, authenticatedRole], using: sql`true` });

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
