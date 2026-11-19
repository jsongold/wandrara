// feed_page（DB）の出力が buildFeed（全件をメモリで処理）と一致することを、同じ DB の中身で確かめる（MS2b）。
// 本物の DB が要るので、FEED_DB_URL を渡したときだけ動く（普段の pnpm test では skip）。
// 使い捨ての DB に migration を当て、supabase/tests/perf/feed_page_fixture.sql を流してから：
//   FEED_DB_URL=postgresql://postgres:postgres@127.0.0.1:54399/postgres pnpm exec vitest run src/lib/feed-page.db.test.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_QUERY } from "./discover-query";
import { buildFeed, type Catalog } from "./feed";
import { loadFeedStrategies } from "./feed-config";
import { fetchFeedPage } from "./feed-page";
import type { DestCard, DiscoverQuery, FeedCard } from "./types";

vi.mock("./data", () => ({ env: () => ({ url: "u" }), supabase: () => ({}), photoUrl: (b: string, k: string) => `${b}/${k}` }));

const url = process.env.FEED_DB_URL;
const psql = (sql: string) => execFileSync("psql", [url!, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { maxBuffer: 1 << 28 }).toString().trim();
const json = <T>(sql: string) => JSON.parse(psql(sql) || "null") as T;

const lit = (v: unknown): string =>
  v === null || v === undefined ? "null" : typeof v === "boolean" || typeof v === "number" ? String(v)
  : Array.isArray(v) ? `array[${v.map(lit).join(",")}]::text[]` : `'${String(v).replace(/'/g, "''")}'`;

// supabase-js の rpc の代わりに、同じ関数を psql で呼ぶ
const db = {
  rpc: async (fn: string, args: Record<string, unknown>) => ({
    data: json(`select public.${fn}(${Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(", ")})`),
    error: null,
  }),
} as unknown as SupabaseClient;

type Row = { dest_id: string; core_type: string; slug: string; is_demo: boolean; created_at: string; published_at: string | null; region_id: string | null; name: DestCard["name"]; summary: DestCard["summary"]; category_ids: string[]; photos: { storage_key: string; license: string | null; credit: string | null }[] };

function loadCatalog(): Catalog {
  const regions = json<{ id: string; parent_id: string | null; name: DestCard["name"]; sort: number }[]>(
    "select json_agg(json_build_object('id', id, 'parent_id', parent_id, 'name', name, 'sort', coalesce(sort, 0)) order by sort, id) from regions",
  )!;
  const rows = json<Row[]>(
    "select json_agg(t) from (select dest_id, core_type, slug, is_demo, created_at, published_at, region_id, name, summary, category_ids, photos from dest_cards order by dest_id) t",
  )!;
  return {
    regions: regions.map((r) => ({ id: r.id, parentId: r.parent_id, name: r.name, sort: r.sort })),
    categories: [],
    dests: rows.map((d): DestCard => ({
      id: d.dest_id, coreType: d.core_type, slug: d.slug, regionId: d.region_id, name: d.name ?? {}, summary: d.summary, isDemo: d.is_demo,
      createdAt: d.created_at, publishedAt: d.published_at, categoryIds: d.category_ids,
      photos: d.photos.map((p) => ({ url: `u/${p.storage_key}`, license: p.license, credit: p.credit, isDemo: false, placeholderSky: null, placeholderLand: null })),
    })),
  };
}

async function allPages(query: DiscoverQuery, limit: number) {
  const cards: FeedCard[] = [];
  let cursor: string | null = null;
  let first = null as Awaited<ReturnType<typeof fetchFeedPage>> | null;
  do {
    const page: Awaited<ReturnType<typeof fetchFeedPage>> = await fetchFeedPage(db, "u", { query, locale: "ja", cursor, limit });
    first ??= page;
    cards.push(...page.cards);
    cursor = page.nextCursor;
  } while (cursor);
  return { cards, first: first! };
}

describe.skipIf(!url)("feed_page は buildFeed と一致する（DB の fixture）", () => {
  const catalog = url ? loadCatalog() : ({} as Catalog);
  const hotTop = url ? psql("select parent_id from regions where parent_id is not null group by 1 order by count(*) desc, 1 limit 1") : "";
  const leaf = url ? psql(`select id from regions where parent_id = '${hotTop}' order by id offset 3 limit 1`) : "";
  const otherTop = url ? psql(`select id from regions where parent_id is null and id <> '${hotTop}' order by id offset 50 limit 1`) : "";
  const cat = url ? psql("select id from categories order by id limit 1") : "";

  const queries: [string, Partial<DiscoverQuery>][] = [
    ["stay", {}], ["do", { mode: "do" }], ["stay fresh", { sort: "fresh" }], ["do fresh", { mode: "do", sort: "fresh" }],
    ["top（集中するエリア）", { area: hotTop }], ["地区", { area: leaf, mode: "do" }], ["別の上位エリア", { area: otherTop }], ["存在しないエリア", { area: "nowhere" }],
    ["カテゴリ", { cat }], ["検索（日本語）", { q: "温泉" }], ["検索（大文字小文字）", { q: "onsen", mode: "do" }],
    ["全部入り", { area: hotTop, cat, q: "温泉", mode: "do", sort: "fresh" }],
  ];

  it.each(queries)("%s：ページを順にたどった結果が buildFeed と同じ", async (_, q) => {
    const query = { ...DEFAULT_QUERY, ...q };
    const expected = buildFeed({ catalog, query, locale: "ja" }, loadFeedStrategies({}));
    for (const limit of [12, 5]) {
      const got = await allPages(query, limit);
      expect(got.cards).toEqual(expected.cards);
      expect(new Set(got.cards.map((c) => c.key)).size).toBe(got.cards.length);
      expect(got.first.orderLabel).toBe(expected.orderLabel);
      expect(got.first.emptyReason).toBe(expected.emptyReason);
      expect(got.first.total).toBe(Math.min(expected.cards.length, 1000));
      expect(got.first.cards).toEqual(expected.cards.slice(0, limit));
    }
  }, 120_000);

  it("fixture の中身：先頭ページに関連タイルが実際に出ている（空のまま一致して見えるのを防ぐ）", () => {
    const f = buildFeed({ catalog, query: DEFAULT_QUERY, locale: "ja" }, loadFeedStrategies({}));
    expect(f.cards.length).toBeGreaterThan(20);
    expect(f.cards.slice(0, 12).some((c) => c.carousel.length > 0)).toBe(true);
  });
});
