import { describe, expect, it } from "vitest";
import { FIXTURE_MANIFEST as M, FIXTURE_SHARD as S } from "../src/lib/region/fixtures.ts";
import { resolveRegion } from "../src/lib/region/resolve.ts";
import type { RepresentativeLocation } from "../src/lib/region/types.ts";
import { applyBackfill, planBackfill, type DestRow } from "./backfill-regions.ts";

const resolve = async (loc: RepresentativeLocation) => resolveRegion(loc, [S], M);
const exists = (id: string) => id in M.parents;
const row = (dest_id: string, region_id: string | null, core: Record<string, unknown>, core_type = "accommodation", details: unknown = null): DestRow => ({
  dest_id, core_type, slug: dest_id, region_id, core, details,
});

describe("planBackfill", () => {
  const rows = [
    row("a", "h", { lat: 0.5, lng: 0.5, geo_precision: "exact" }), // h → h1
    row("b", "hp", { lat: 0.5, lng: 0.5, geo_precision: "exact" }), // 点のエリアは残す
    row("c", "i", { lat: 4.5, lng: 0.5, geo_precision: "exact" }), // 決まらない → 今の値のまま（差分なし）
    row("f", null, { lat: 4.5, lng: 0.5, geo_precision: "exact" }), // 決まらず値も無い → 理由つきでそのまま
    row("d", "i1", { lat: 2.5, lng: 1, geo_precision: "exact" }), // 同じ → 差分なし
    row("e", null, {}, "experience", { locations: [{ kind: "meeting", lat: 0.5, lng: 6.5, geo_precision: "street" }] }),
  ];
  it("変わるものだけ差分に入れ、決まらないものは理由つきでそのまま", async () => {
    const p = await planBackfill(rows, resolve, M, exists);
    expect(p.changes.map((c) => [c.dest_id, c.old_region_id, c.new_region_id])).toEqual([
      ["a", "h", "h1"],
      ["e", null, "i2"],
    ]);
    expect(p.changes[1]).toMatchObject({ lat: 0.5, lng: 6.5, geo_precision: "street" });
    expect(p.kept).toEqual([{ dest_id: "f", slug: "f", region_id: null, reason: "outside" }]);
  });
  it("差分を当てた後にもう一度出すと差分ゼロ", async () => {
    const p = await planBackfill(rows, resolve, M, exists);
    const after = rows.map((r) => ({ ...r, region_id: p.changes.find((c) => c.dest_id === r.dest_id)?.new_region_id ?? r.region_id }));
    expect((await planBackfill(after, resolve, M, exists)).changes).toEqual([]);
  });
});

describe("applyBackfill", () => {
  it("1 件ずつ RPC を呼び、結果を数える", async () => {
    const calls: unknown[] = [];
    const db = { rpc: async (_fn: string, args: { p: { dest_id: string } }) => (calls.push(args.p), { data: args.p.dest_id === "a" ? "updated" : "skipped", error: null }) };
    const plan = await planBackfill([row("a", "h", { lat: 0.5, lng: 0.5, geo_precision: "exact" }), row("x", "h", { lat: 0.5, lng: 1.5, geo_precision: "exact" })], resolve, M, exists);
    expect(await applyBackfill(db as never, plan)).toEqual({ updated: 1, skipped: 1, missing: 0 });
    expect(calls).toHaveLength(2);
  });
});
