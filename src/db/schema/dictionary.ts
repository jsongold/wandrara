// 辞書：地域と分類。誰でも読める
import { sql } from "drizzle-orm";
import { check, foreignKey, integer, jsonb, pgPolicy, pgTable, text } from "drizzle-orm/pg-core";
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
    municipalityCode: text("municipality_code"),
    sort: integer("sort"),
  },
  (t) => [
    foreignKey({ name: "regions_parent_id_fkey", columns: [t.parentId], foreignColumns: [t.id] }),
    check("regions_id_check", sql`${t.id} ~ '^[a-z0-9-]{1,40}$'`),
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
