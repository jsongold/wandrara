// スキーマから migration の SQL を作る（generate / export だけ。DB には繋がない）
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*.ts",
  out: "./supabase/migrations",
  migrations: { prefix: "supabase" },
  entities: { roles: { provider: "supabase" } },
});
