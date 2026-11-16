/* eslint-disable @typescript-eslint/no-explicit-any -- 検証のテストで、わざと形の崩れた入力を作るため */
import { describe, expect, it } from "vitest";
import { bundleJsonSchema, parseBundle, parseDestInput } from "./bundle.ts";
import { coreByType } from "./cores.ts";
import { jsonDetailsCore, tableDetailsCore, withAccommodationQuality } from "./test-fixtures.ts";

const acc = coreByType("accommodation")!;
const dest = () => withAccommodationQuality({
  core_type: "accommodation",
  ref: "WR-atami-008",
  core: { kind: "private_rental", region_id: "atami", lat: 35.03 },
  texts: [{ lang: "ja", name: "ヴィラ" }],
  details: {
    rooms: [{ key: "main", capacity: 10, area_sqm: 45.5, bedrooms: [{ beds: [{ type: "double", count: 2 }] }] }],
    baths: [{ kind: "private" }],
  },
  categories: ["onsen"],
  photos: [{ file: "images/001.jpg", subject: "exterior" }],
}, "file");
const bundle = (d: unknown) => ({ bundle_version: "2", collector: "c", collected_at: "2026-11-15T10:00:00+09:00", dests: [d] });

describe("parseBundle", () => {
  it("通る。宿の details は JSON のまま（数は number）", () => {
    const r = parseBundle(bundle(dest()));
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value.dests[0].details as any).rooms[0].area_sqm).toBe(45.5);
  });
  it("宿の表の形の details（units・prices の配列）を弾く", () => {
    const d = dest() as any;
    d.details = { units: [{ capacity: 2 }], prices: [{ amount: 20000, currency: "JPY", guests: 2 }] };
    const r = parseBundle(bundle(d));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain('/dests/0/details Unrecognized key: "units"');
      expect(r.errors.some((e) => e.startsWith("/dests/0/details/prices "))).toBe(true);
    }
  });
  it("料金の room が rooms に無いと弾く", () => {
    const d = dest() as any;
    d.details.prices = { items: [{ kind: "room", per: "room_night", room: "annex", amount: 10000, currency: "JPY" }] };
    const r = parseBundle(bundle(d));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(["/dests/0/details/prices/items/0/room 部屋 annex が rooms の key に無い"]);
  });
  it("写真の room が rooms に無いと、中身の決まりで弾く", () => {
    const d = dest() as any;
    d.photos = [{ file: "images/001.jpg", room: "annex" }];
    const r = parseBundle(bundle(d));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(["/dests/0/photos 写真の room は details.rooms の key のどれか"]);
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
    d.details.rooms[0].capacity = "many";
    d.core.kind = "castle";
    const r = parseBundle(bundle(d));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith("/dests/0/core/kind"))).toBe(true);
      expect(r.errors.some((e) => e.startsWith("/dests/0/details/rooms/0/capacity"))).toBe(true);
    }
  });
  it("operator_id を受けない", () => {
    const a = dest() as any;
    a.core.operator_id = "00000000-0000-0000-0000-000000000000";
    expect(parseBundle(bundle(a)).ok).toBe(false);
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
  const s = JSON.stringify(bundleJsonSchema());
  expect(s.length).toBeGreaterThan(1000);
  expect(s).toContain('"room"');
});

it("photos の room は key の形だけ受ける（bundle・API とも）", () => {
  const d = dest() as any;
  d.details.rooms.push({ key: "main-room_1" });
  d.photos = [{ file: "images/001.jpg", room: "main-room_1" }];
  expect(parseBundle(bundle(d)).ok).toBe(true);
  d.photos = [{ file: "images/001.jpg", room: "Main Room" }];
  expect(parseBundle(bundle(d)).ok).toBe(false);
  const a = dest() as any;
  delete a.core_type;
  expect(parseDestInput(acc, { ...a, photos: [{ storage_key: "a.jpg", room: "main" }] }).ok).toBe(true);
});

describe("detailsSchema を持つコア", () => {
  const body = (details: unknown) => ({
    ref: "WR-json-001",
    core: { kind: "hotel" },
    texts: [{ lang: "ja", name: "宿" }],
    details,
    photos: [{ storage_key: "a.jpg" }],
  });
  it("details は detailsSchema で確かめる", () => {
    const r = parseDestInput(jsonDetailsCore, body({ rooms: [{ key: "r1" }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.details).toEqual({ rooms: [{ key: "r1" }] });
    expect(parseDestInput(jsonDetailsCore, body(undefined)).ok).toBe(true);
  });
  it("detailsSchema に合わない details・表の形の details を弾く", () => {
    expect(parseDestInput(jsonDetailsCore, body({ rooms: [{ key: 1 }] })).ok).toBe(false);
    expect(parseDestInput(jsonDetailsCore, body({ units: [{ capacity: 2 }] })).ok).toBe(false);
  });
});

describe("体験・自然・建物・日帰り温泉・まちは details を JSON 1 つで受ける", () => {
  const body = (details: unknown) => ({ core: {}, texts: [{ lang: "ja", name: "x" }], details, photos: [{ storage_key: "a.jpg" }] });
  const oldTables: [string, unknown][] = [
    ["experience", { courses: [{ name: { ja: "x" }, max_people: 8 }], prices: [{ amount: 3000, currency: "JPY" }] }],
    ["nature", { access: [{ has_parking: true }], hours_fees: [{ amount: 0 }] }],
    ["building", { hours: [{ open_time: "09:00" }], fees: [{ amount: 500, currency: "JPY" }] }],
    ["hotspring", { baths: [{ bath_type: "indoor", spring_quality: "単純温泉" }], hours: [{ opens_at: "10:00" }] }],
    ["village", { walks: [{ area: { ja: "駅前" }, duration_min: 30 }], access: [{ kind: "bus" }] }],
  ];
  it.each(oldTables)("%s: 旧い表の形の details を弾く", (type, details) => {
    const r = parseDestInput(coreByType(type)!, body(details));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("/details"))).toBe(true);
  });
  it("新しい形は details の形を通る（中身の決まりは別）", () => {
    const r = parseDestInput(coreByType("nature")!, body({ access: { mode: "walk" } }));
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("/details"))).toBe(false);
  });
});

describe("詳細の表で受けるコア", () => {
  const body = (details: any) => ({ core: { kind: "museum" }, texts: [{ lang: "ja", name: "資料館" }], details, photos: [{ storage_key: "a.jpg" }] });
  it("表の詳細を受ける。numeric は string になる", () => {
    const r = parseDestInput(tableDetailsCore, body({ fees: [{ amount: 500.5, currency: "JPY" }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value.details as any).fees[0].amount).toBe("500.5");
  });
  it("表にない列・キーを受けない", () => {
    expect(parseDestInput(tableDetailsCore, body({ fees: [{ amount: 500, currency: "JPY", course_id: "x" }] })).ok).toBe(false);
    expect(parseDestInput(tableDetailsCore, body({ units: [{ capacity: 2 }] })).ok).toBe(false);
  });
});

describe("scripts/import-bundle の fixture bundle", () => {
  it("宿・体験・自然・建物・日帰り温泉・まち（新しい形）が中身の決まりまで通る", async () => {
    const { readFile } = await import("node:fs/promises");
    const json = JSON.parse(await readFile(new URL("../../../scripts/import-bundle/fixtures/bundle.json", import.meta.url), "utf8"));
    const r = parseBundle(json);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.value.dests.map((d) => d.core_type)).toEqual(["accommodation", "experience", "nature", "building", "hotspring", "village"]);
  });
});
