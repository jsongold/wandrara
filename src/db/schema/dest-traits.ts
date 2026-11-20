// dest ごとの特徴の値（dest × 特性）。特性の定義は traits（地域の特性 region_traits と共用）
import { sql } from "drizzle-orm";
import { check, doublePrecision, index, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { publishedRead } from "./_shared.ts";
import { destinations } from "./common.ts";
import { traits } from "./dictionary.ts";

// value：flag は 1、number・level はその値。値が無いもの（根拠が無い）は行を作らない
// evidence：根拠の文（紹介文からの引用など）。confidence：0〜1。version：作り方の版（例 text-haiku-v1）
export const destTraits = pgTable(
  "dest_traits",
  {
    destId: uuid("dest_id")
      .notNull()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    traitId: text("trait_id")
      .notNull()
      .references(() => traits.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    evidence: text("evidence"),
    confidence: real("confidence"),
    version: text("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "dest_traits_pkey", columns: [t.destId, t.traitId] }),
    index("dest_traits_trait_id_idx").on(t.traitId),
    check("dest_traits_confidence_check", sql`${t.confidence} is null or (${t.confidence} >= 0 and ${t.confidence} <= 1)`),
    publishedRead(t.destId),
  ],
);
