/* eslint-disable @typescript-eslint/no-explicit-any -- 検証のテストで、わざと形の崩れた入力を作るため */
import { describe, expect, it } from "vitest";
import { bundleJsonSchema, parseBundle, parseDestInput } from "./bundle.ts";
import { coreByType } from "./cores.ts";
import { withAccommodationQuality } from "./test-fixtures.ts";

const acc = coreByType("accommodation")!;
const dest = () => withAccommodationQuality({
  core_type: "accommodation",
  ref: "WR-atami-008",
  core: { kind: "private_rental", region_id: "atami", lat: 35.03 },
  texts: [{ lang: "ja", name: "ヴィラ" }],
  details: {
    units: [{ capacity: 10, area_sqm: 45.5, bedrooms: [{ beds: [{ bed_type: "double", count: 2 }] }] }],
    baths: [{ kind: "private" }],
  },
  categories: ["onsen"],
  photos: [{ file: "images/001.jpg", subject: "exterior" }],
}, "file");
const bundle = (d: unknown) => ({ bundle_version: "2", collector: "c", collected_at: "2026-11-15T10:00:00+09:00", dests: [d] });

describe("parseBundle", () => {
  it("通る。numeric は string になる", () => {
    const r = parseBundle(bundle(dest()));
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value.dests[0].details as any).units[0].area_sqm).toBe("45.5");
  });
  it("同じ ref が 2 回ある bundle を弾く（ref の無いものは重ならない）", () => {
    const b = bundle(dest()) as any;
    const noRef = () => ({ ...dest(), ref: undefined });
    b.dests = [dest(), { ...dest(), ref: "WR-other-001" }, dest(), noRef(), noRef()];
    const r = parseBundle(b);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]).toContain("/dests/2/ref");
      expect(r.errors[0]).toContain("/dests/0");
    }
  });
  it("知らないキーを弾く", () => {
    const d = dest() as any;
    d.core.bogus = 1;
    const r = parseBundle(bundle(d));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toContain("/dests/0");
  });
  it("型違い・kind の値違いを弾く", () => {
    const d = dest() as any;
    d.details.units[0].capacity = "many";
    d.core.kind = "castle";
    const r = parseBundle(bundle(d));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith("/dests/0/core/kind"))).toBe(true);
      expect(r.errors.some((e) => e.startsWith("/dests/0/details/units/0/capacity"))).toBe(true);
    }
  });
  it("operator_id と、親以外の詳細を指す列（unit_id）を受けない", () => {
    const a = dest() as any;
    a.core.operator_id = "00000000-0000-0000-0000-000000000000";
    expect(parseBundle(bundle(a)).ok).toBe(false);
    const b = dest() as any;
    b.details.baths[0].unit_id = "00000000-0000-0000-0000-000000000000";
    expect(parseBundle(bundle(b)).ok).toBe(false);
  });
  it("photos は file か url のどちらか", () => {
    const d = dest() as any;
    d.photos = [{ subject: "view" }];
    expect(parseBundle(bundle(d)).ok).toBe(false);
  });
});

describe("parseDestInput", () => {
  it("API では storage_key が要る", () => {
    const { core_type: _t, ...d } = dest() as any;
    expect(parseDestInput(acc, d).ok).toBe(false);
    d.photos = [{ storage_key: "abc.jpg" }];
    expect(parseDestInput(acc, d).ok).toBe(true);
  });
});

it("ref は英数字・_・- の 1〜80 文字", () => {
  const d = () => {
    const { core_type: _t, ...x } = dest() as any;
    return { ...x, photos: [{ storage_key: "abc.jpg" }] };
  };
  expect(parseDestInput(acc, { ...d(), ref: "WR-atami_008" }).ok).toBe(true);
  for (const ref of ["a b", "宿", "a/b", "x".repeat(81)]) expect(parseDestInput(acc, { ...d(), ref }).ok).toBe(false);
});

it("bundleJsonSchema を出せる", () => {
  expect(JSON.stringify(bundleJsonSchema()).length).toBeGreaterThan(1000);
});
