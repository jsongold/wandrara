// used_root_categories / area_item_traits（DB の集計）が、旧実装（dest 全件をメモリに読んで JS で数える）と同じ結果になることを、同じ DB の中身で確かめる（MS2c）。
// 本物の DB が要るので、FEED_DB_URL を渡したときだけ動く（普段の pnpm test では skip）。feed-page.db.test.ts と同じ手順：
//   使い捨ての DB に migration を当て、supabase/tests/perf/feed_page_fixture.sql を流してから：
//   FEED_DB_URL=postgresql://postgres:postgres@127.0.0.1:54398/postgres pnpm exec vitest run src/lib/area-meta.db.test.ts
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { MODES } from "./modes";

const url = process.env.FEED_DB_URL;
const psql = (sql: string) => execFileSync("psql", [url!, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { maxBuffer: 1 << 28 }).toString().trim();
const json = <T>(sql: string) => JSON.parse(psql(sql) || "null") as T;

type Dest = { core_type: string; region_id: string | null; category_ids: string[] };
type Cat = { id: string; parent_id: string | null };
type Trait = { id: string; source: string; category_ids: string[] | null };

describe.skipIf(!url)("DB の集計 = 旧実装（全件をメモリで数える）", () => {
  const dests = () => json<Dest[]>("select json_agg(t) from (select core_type, region_id, category_ids from dest_cards) t")!;

  it.each(Object.keys(MODES))("used_root_categories(%s) は旧 listCategories と同じ", (mode) => {
    const coreTypes = MODES[mode as keyof typeof MODES] as readonly string[];
    const cats = json<Cat[]>("select json_agg(t) from (select id, parent_id from categories) t")!;
    const used = new Set(dests().filter((d) => coreTypes.includes(d.core_type)).flatMap((d) => d.category_ids));
    const expected = cats.filter((c) => used.has(c.id) && !c.parent_id).map((c) => c.id).sort();
    const got = json<string[]>(`select to_json(public.used_root_categories(array[${coreTypes.map((c) => `'${c}'`).join(",")}]))`)!;
    expect(expected.length).toBeGreaterThan(0);
    expect([...got].sort()).toEqual(expected);
  });

  it("area_item_traits は旧 areaTraitsOf の items と同じ（エリアは地区そのもの）", () => {
    const traits = json<Trait[]>("select json_agg(t) from (select id, source, category_ids from traits) t")!;
    const expected: Record<string, Set<string>> = {};
    for (const t of traits) {
      if (t.source !== "items" || !t.category_ids?.length) continue;
      const cats = new Set(t.category_ids);
      for (const d of dests()) if (d.region_id && d.category_ids.some((c) => cats.has(c))) (expected[d.region_id] ??= new Set()).add(t.id);
    }
    const got = json<Record<string, string[]>>("select public.area_item_traits()")!;
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(Object.fromEntries(Object.entries(got).map(([k, v]) => [k, [...v].sort()]))).toEqual(
      Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, [...v].sort()])),
    );
  });
});
