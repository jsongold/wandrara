import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, listItems } from "./items.ts";

function mockDb(tables: Record<string, unknown[]>): SupabaseClient {
  return {
    from: (t: string) => {
      const chain: unknown = new Proxy({}, {
        get: (_o, p) => (p === "then" ? (res: (v: unknown) => void) => res({ data: tables[t] ?? [] }) : () => chain),
      });
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("isAdmin", () => {
  it("カンマ区切りに入っていれば true", () => {
    expect(isAdmin("u2", "u1, u2")).toBe(true);
  });
  it("入っていない・未設定なら false", () => {
    expect(isAdmin("u3", "u1,u2")).toBe(false);
    expect(isAdmin("u1", undefined)).toBe(false);
  });
});

describe("listItems", () => {
  it("名前の言語・投入キー名・並び", async () => {
    const db = mockDb({
      destinations: [
        { dest_id: "a", core_type: "accommodation", slug: "aaa", ref: "R-1", updated_at: "2026-01-01T00:00:00Z" },
        { dest_id: "b", core_type: "experience", slug: "bbb", ref: null, updated_at: "2026-02-01T15:30:00Z" },
        { dest_id: "c", core_type: "nature", slug: "ccc", ref: null, updated_at: "2026-01-15T00:00:00Z" },
      ],
      publications: [{ dest_id: "a", status: "published" }],
      accommodation_texts: [{ dest_id: "a", lang: "en", name: "A en" }, { dest_id: "a", lang: "ja", name: "A ja" }],
      experience_texts: [{ dest_id: "b", lang: "en", name: "B en" }],
      dest_imports: [
        { dest_id: "a", collector_key_id: "k2", imported_at: "2026-01-02" },
        { dest_id: "a", collector_key_id: "k1", imported_at: "2026-01-01" },
      ],
      collector_keys: [{ id: "k1", name: "old" }, { id: "k2", name: "new" }],
    });
    const items = await listItems(db);
    expect(items.map((i) => i.slug)).toEqual(["bbb", "ccc", "aaa"]);
    expect(items.map((i) => i.name)).toEqual(["B en", "ccc", "A ja"]);
    expect(items.map((i) => i.keyName)).toEqual(["-", "-", "new"]);
    expect(items.map((i) => i.status)).toEqual(["draft", "draft", "published"]);
    expect(items[2].typeLabel).toBe("宿");
  });
});
