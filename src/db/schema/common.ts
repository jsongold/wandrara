// 全コアで共通の表：共通の ID・公開・写真・分類・取り込みの記録
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole } from "drizzle-orm/supabase";
import { CORE_TYPES, destChildColumns, localized, oneOf, publishedRead } from "./_shared.ts";
import { categories } from "./dictionary.ts";
import { collectorKeys, users } from "./people.ts";

export const destinations = pgTable(
  "destinations",
  {
    destId: uuid("dest_id").primaryKey().defaultRandom(),
    coreType: text("core_type").notNull(),
    slug: text("slug").notNull().unique(),
    /** 収集元の ID（例 WR-atami-008） */
    ref: text("ref").unique(),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    oneOf("destinations_core_type_check", t.coreType, CORE_TYPES),
    check("destinations_slug_check", sql`${t.slug} ~ '^[a-z0-9-]{3,60}$'`),
    publishedRead(t.destId),
  ],
);

export const PUBLICATION_STATUSES = ["draft", "published"] as const;

export const publications = pgTable(
  "publications",
  {
    destId: uuid("dest_id")
      .primaryKey()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    oneOf("publications_status_check", t.status, PUBLICATION_STATUSES),
    pgPolicy("public read", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${t.status} = 'published'`,
    }),
  ],
);

export const PHOTO_SUBJECTS = ["exterior", "room", "bath", "view", "food", "activity", "landscape", "other"] as const;

export const destPhotos = pgTable(
  "dest_photos",
  {
    ...destChildColumns(),
    /** バケット dest-photos の中のパス（<sha256>.<拡張子>） */
    storageKey: text("storage_key").notNull(),
    license: text("license"),
    credit: text("credit"),
    sourcePageUrl: text("source_page_url"),
    originalUrl: text("original_url"),
    subject: text("subject"),
    /** 部屋やコースの id（その dest に属するもの） */
    subjectRef: uuid("subject_ref"),
    alt: localized("alt"),
  },
  (t) => [
    index("dest_photos_dest_id_idx").on(t.destId),
    oneOf("dest_photos_subject_check", t.subject, PHOTO_SUBJECTS),
    publishedRead(t.destId),
  ],
);

export const destCategories = pgTable(
  "dest_categories",
  {
    destId: uuid("dest_id")
      .notNull()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.destId, t.categoryId] }), publishedRead(t.destId)],
);

// ポリシー無し（service_role だけ）
export const destImports = pgTable(
  "dest_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    destId: uuid("dest_id").references(() => destinations.destId, { onDelete: "set null" }),
    ref: text("ref"),
    collectorKeyId: uuid("collector_key_id").references(() => collectorKeys.id, { onDelete: "set null" }),
    /** 受け取った入力そのまま（出典もここに残る） */
    payload: jsonb("payload").notNull(),
    /** 中身のハッシュ（sources・verification_status を除く）。前回と同じなら書き込みを飛ばす */
    contentHash: text("content_hash"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dest_imports_dest_id_idx").on(t.destId)],
).enableRLS();

// 中身の決まり（src/lib/ingest/quality.ts）を今の dest に当てた結果。dest ごとに 1 行。pnpm dest:quality-check が全部入れ直す。
// ポリシー無し（service_role だけ）
export const destQualityCheck = pgTable(
  "dest_quality_check",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    destId: uuid("dest_id")
      .notNull()
      .unique()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    /** 満たした決まりの割合（0〜100。100 = 全部満たす） */
    quality: integer("quality").notNull(),
    /** { version, issues: [{ path, message }] }。issues が空なら全部満たす */
    reason: jsonb("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** 結果を入れ直したとき now にする */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("dest_quality_check_quality_check", sql`${t.quality} between 0 and 100`)],
).enableRLS();
