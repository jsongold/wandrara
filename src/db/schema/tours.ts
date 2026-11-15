// Tour：旅の計画。持ち主は全部、is_public なら誰でも読む。stops・shares は持ち主の tour のものだけ
import { sql } from "drizzle-orm";
import { boolean, index, integer, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole, authUid } from "drizzle-orm/supabase";
import type { PgColumn } from "drizzle-orm/pg-core";
import { destinations } from "./common.ts";
import { users } from "./people.ts";

export const tours = pgTable(
  "tours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tours_owner_id_idx").on(t.ownerId),
    pgPolicy("owner all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.ownerId} = ${authUid}`,
      withCheck: sql`${t.ownerId} = ${authUid}`,
    }),
    pgPolicy("public read", { for: "select", to: [anonRole, authenticatedRole], using: sql`${t.isPublic}` }),
  ],
);

/** tour_id の tour の持ち主が自分か */
const ownsTour = (tourId: PgColumn) =>
  sql`exists (select 1 from ${tours} where ${tours.id} = ${tourId} and ${tours.ownerId} = ${authUid})`;

export const tourStops = pgTable(
  "tour_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tourId: uuid("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    destId: uuid("dest_id")
      .notNull()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    sort: integer("sort").notNull().default(0),
    day: integer("day"),
    note: text("note"),
  },
  (t) => [
    index("tour_stops_tour_id_idx").on(t.tourId),
    pgPolicy("owner all", { for: "all", to: authenticatedRole, using: ownsTour(t.tourId), withCheck: ownsTour(t.tourId) }),
  ],
);

export const tourShares = pgTable(
  "tour_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tourId: uuid("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("tour_shares_tour_id_idx").on(t.tourId),
    pgPolicy("owner all", { for: "all", to: authenticatedRole, using: ownsTour(t.tourId), withCheck: ownsTour(t.tourId) }),
  ],
);
