// トップのカテゴリ・エリアシートのデータ・Catalog の上限（MS2c）。DB の集計は supabase/tests（feed_page.db.test と同じく本物の DB が要る）で別に確かめる
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./supabase/fake-db";

const { cacheTag, cacheLife } = vi.hoisted(() => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("next/cache", () => ({ cacheTag, cacheLife }));

const state = vi.hoisted(() => ({ make: null as null | (() => unknown) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => state.make!() }));

// select / is / order … のあとに await できる 1 回の取得と、rpc
function client(tables: Record<string, unknown[]>, rpc: Record<string, unknown>) {
  return {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "is", "order", "in"]) q[m] = () => q;
      q.range = async () => ({ data: tables[table] ?? [], error: null });
      q.then = (res: (v: unknown) => unknown) => res({ data: tables[table] ?? [], error: null });
      return q;
    },
    rpc: async (fn: string, args?: unknown) => ({ data: fn in rpc ? (typeof rpc[fn] === "function" ? (rpc[fn] as (a: unknown) => unknown)(args) : rpc[fn]) : null, error: null }),
  };
}

const cat = (id: string) => ({ id, name: { ja: `カテゴリ${id}`, en: `Cat ${id}` }, icon: `i-${id}` });

describe("listCategories", () => {
  beforeEach(() => {
    cacheTag.mockClear();
    cacheLife.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
  });

  it("DB が数えた『その mode で使われている親なしカテゴリ』だけを、カテゴリの並びで返す。mode の core_type を DB に渡す", async () => {
    const used = vi.fn(() => ["lake", "onsen"]);
    state.make = () => client({ categories: [cat("onsen"), cat("hike"), cat("lake")] }, { used_root_categories: used });
    const { listCategories } = await import("./data");
    expect(await listCategories("stay", "ja")).toEqual([
      { id: "onsen", label: "カテゴリonsen", icon: "i-onsen" },
      { id: "lake", label: "カテゴリlake", icon: "i-lake" },
    ]);
    expect(used).toHaveBeenCalledWith({ p_core_types: ["accommodation"] });
    expect((await listCategories("stay", "en"))[0].label).toBe("Cat onsen");
  });

  it("公開・非公開で変わるので catalog tag を付け、寿命は getCatalog と同じ（約 1 分で取り直し・1 時間で失効）", async () => {
    state.make = () => client({ categories: [] }, { used_root_categories: [] });
    const { listCategories } = await import("./data");
    await listCategories("stay", "ja");
    expect(cacheTag.mock.calls.flat()).toContain("catalog");
    expect(cacheLife).toHaveBeenCalledWith({ stale: 300, revalidate: 60, expire: 3600 });
  });
});

describe("getAreaSheetData", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
  });

  it("地域のマスターから親と地区を、DB が集計した特性と土地由来の特性からエリアごとの特性を作る。dest は読まない", async () => {
    const from = vi.fn();
    const c = client(
      {
        regions: [
          { id: "hakone", parent_id: null, name: { ja: "箱根" }, sort: 1 },
          { id: "gora", parent_id: "hakone", name: { ja: "強羅" }, sort: 1 },
        ],
        traits: [{ id: "onsen", name: { ja: "温泉" }, icon: "steam", sort: 10, source: "items", category_ids: ["onsen"] }],
        region_traits: [],
      },
      { area_item_traits: { gora: ["onsen"] } },
    );
    state.make = () => ({ ...c, from: (t: string) => (from(t), c.from(t)) });
    const { getAreaSheetData } = await import("./data");
    const got = await getAreaSheetData("ja");
    expect(got.areas).toEqual([{ id: "hakone", label: "箱根", subs: [{ id: "gora", label: "強羅" }] }]);
    expect(got.traits).toEqual({ traits: [{ id: "onsen", label: "温泉", icon: "steam" }], byRegion: { gora: ["onsen"] } });
    expect(from.mock.calls.flat()).not.toContain("dest_cards");
  });
});

describe("getCatalog の上限", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
  });

  it("dest が CATALOG_MAX_DESTS を超えたら CatalogTooLargeError を投げ、上限を大きく超えて読み続けない", async () => {
    const { CATALOG_MAX_DESTS, CatalogTooLargeError, getCatalog } = await import("./data");
    const card = (i: number) => ({ dest_id: `d${String(i).padStart(6, "0")}`, core_type: "accommodation", slug: `s${i}`, is_demo: false, created_at: "2026-01-01", published_at: null, region_id: null, name: {}, summary: null, category_ids: [], photos: [] });
    const fake = fakeDb({ dest_cards: Array.from({ length: CATALOG_MAX_DESTS * 3 }, (_, i) => card(i)), regions: [] });
    const paged = fake.db as unknown as { from: (t: string) => unknown };
    state.make = () => ({
      from: (table: string) => {
        if (table !== "categories") return paged.from(table);
        const q: Record<string, unknown> = { select: () => q, order: () => q, then: (res: (v: unknown) => unknown) => res({ data: [], error: null }) };
        return q;
      },
    });
    await expect(getCatalog()).rejects.toBeInstanceOf(CatalogTooLargeError);
    // 3000 件を超えた最初のページ（4 ページ目）で止まる。9000 件を全部は読まない
    expect(fake.ranges.length).toBeLessThanOrEqual(5);
  });
});
