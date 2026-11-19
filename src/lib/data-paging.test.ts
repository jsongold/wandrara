// getCatalog は dest_cards を 1000 件で切らずに全部読み、途中のページが失敗したら黙って欠けず throw する（MS1a）
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./supabase/fake-db";

const state = vi.hoisted(() => ({ make: null as null | (() => unknown) }));

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => state.make!() }));

const card = (i: number) => ({
  dest_id: `d${String(i).padStart(5, "0")}`, core_type: "accommodation", slug: `s${i}`, is_demo: false,
  created_at: "2026-01-01", published_at: null, region_id: null, name: { ja: `宿${i}` }, summary: null, category_ids: [], photos: [],
});

// dest_cards と regions はページ送り、categories は 1 回の select（thenable）
function client(cards: number, opts: Parameters<typeof fakeDb>[1] = {}) {
  const paged = fakeDb({ dest_cards: Array.from({ length: cards }, (_, i) => card(i)), regions: [] }, opts).db;
  return {
    from: (table: string) => {
      if (table !== "categories") return (paged as unknown as { from: (t: string) => unknown }).from(table);
      const q: Record<string, unknown> = { select: () => q, order: () => q, then: (res: (v: unknown) => unknown) => res({ data: [], error: null }) };
      return q;
    },
  };
}

describe("getCatalog の dest_cards", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
  });

  it("1000 件を超えても全部読み、dest_id の順で返す", async () => {
    state.make = () => client(2345);
    const { getCatalog } = await import("./data");
    const { dests } = await getCatalog();
    expect(dests).toHaveLength(2345);
    expect(dests[0].id).toBe("d00000");
    expect(dests.at(-1)?.id).toBe("d02344");
  });

  it("途中のページが失敗したら throw する", async () => {
    state.make = () => client(2345, { failAtFrom: 1000 });
    const { getCatalog } = await import("./data");
    await expect(getCatalog()).rejects.toThrow("dest_cards: page failed");
  });
});
