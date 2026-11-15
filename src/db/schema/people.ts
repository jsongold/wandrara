// 利用者と運営者・保存・API キー
import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";
import { oneOf } from "./_shared.ts";
import { destinations } from "./common.ts";

/** auth.users に入ったら trigger で作る（m1） */
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    locale: text("locale"),
    currency: text("currency"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("self read", { for: "select", to: authenticatedRole, using: sql`${t.id} = ${authUid}` }),
    pgPolicy("self update", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
  ],
);

export const OPERATOR_KINDS = ["company", "individual", "municipality", "organization"] as const;

// ポリシー無し（service_role だけ）
export const operators = pgTable(
  "operators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: text("kind"),
    contactEmail: text("contact_email"),
    contactUrl: text("contact_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [oneOf("operators_kind_check", t.kind, OPERATOR_KINDS)],
).enableRLS();

export const operatorMemberships = pgTable(
  "operator_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.operatorId] }),
    pgPolicy("self read", { for: "select", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
  ],
);

export const userSaves = pgTable(
  "user_saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destId: uuid("dest_id")
      .notNull()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.destId] }),
    pgPolicy("self all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
  ],
);

// ポリシー無し（service_role だけ）
export const collectorKeys = pgTable("collector_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** API キーの sha256 の hex */
  keyHash: text("key_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}).enableRLS();
