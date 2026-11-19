// 件数が増えても buildFeed が遅くならないこと、出力が変わらないことを確かめる（MS1b）。
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY } from "./discover-query";
import { buildFeed, type Catalog } from "./feed";
import { loadFeedStrategies } from "./feed-config";
import type { DestCard, DiscoverQuery, Region } from "./types";

// 決まった乱数（実行のたびに同じ fixture を作る）
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 本番に近い規模：地域 1,000 件（上位 50 × 下位 19）、dest 500 件
function bigCatalog(): Catalog {
  const rnd = lcg(42);
  const regions: Region[] = [];
  for (let i = 0; i < 50; i++) {
    regions.push({ id: `r${i}`, parentId: null, name: { ja: `地域${i}`, en: `Region ${i}` }, sort: i });
    for (let j = 0; j < 19; j++) regions.push({ id: `r${i}-${j}`, parentId: `r${i}`, name: { ja: `地区${i}-${j}` }, sort: j });
  }
  const types = ["accommodation", "experience", "nature", "building", "hotspring", "village"];
  const dests: DestCard[] = [];
  for (let k = 0; k < 500; k++) {
    const region = regions[Math.floor(rnd() * regions.length)];
    dests.push({
      id: `d${k}`, coreType: types[k % types.length], slug: `d${k}`, regionId: k % 25 === 0 ? null : region.id,
      categoryIds: [], isDemo: false, name: { ja: `場所${k}` }, summary: null,
      photos: [], createdAt: `2026-01-01T00:00:${String(k % 60).padStart(2, "0")}Z`,
      publishedAt: k % 7 === 0 ? null : `2026-02-${String(1 + (k % 28)).padStart(2, "0")}T00:00:00Z`,
    });
  }
  return { regions, categories: [], dests };
}

const queries: Partial<DiscoverQuery>[] = [{}, { mode: "do" }, { area: "r3" }, { area: "r7-2", mode: "do" }, { sort: "fresh" }];

const run = (catalog: Catalog, q: Partial<DiscoverQuery>) =>
  buildFeed({ catalog, query: { ...DEFAULT_QUERY, ...q }, locale: "ja" }, loadFeedStrategies({}));

describe("buildFeed（大きい catalog）", () => {
  it("出力は変更前（地域の索引を毎回作っていた版）と同じ", () => {
    const catalog = bigCatalog();
    const out = queries.map((q) => run(catalog, q));
    // 関連タイルが実際に出ていること（空のまま一致して見えるのを防ぐ）
    expect(out[0].cards.some((c) => c.carousel.length > 0)).toBe(true);
    const hash = createHash("sha256").update(JSON.stringify(out)).digest("hex");
    // 関連タイルを全種類にした（secondary=related-any-kind@1）ときと、tiles を carousel（CarouselItem[]）にして algorithm に carousel 段を足したとき（中身は前と同じことを確かめた）に更新した
    expect(hash).toBe("fa433763ea5093d631573280da98dbf6411842a07f9a0f71054206984d6ae3f3");
  });

  it("5 つの条件を組み立てても遅くならない（変更前は約 3.6 秒。しきい値は余裕を持たせてある）", () => {
    const catalog = bigCatalog();
    const t0 = performance.now();
    for (const q of queries) run(catalog, q);
    const ms = performance.now() - t0;
    console.info(`buildFeed x${queries.length}: ${ms.toFixed(0)}ms`);
    expect(ms).toBeLessThan(1500);
  });
});
