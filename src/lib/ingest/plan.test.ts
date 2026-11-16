import { describe, expect, it } from "vitest";
import { parseDestInput } from "./bundle.ts";
import { coreByType } from "./cores.ts";
import { planDestWrite, type DestRefs } from "./plan.ts";
import { jsonDetailsCore, tableDetailsCore, withAccommodationQuality, withBuildingQuality, withExperienceQuality, withHotspringQuality, withNatureQuality, withVillageQuality } from "./test-fixtures.ts";

const acc = coreByType("accommodation")!;
// 詳細の表で受けるコア（表の書き込みを確かめる）
const tab = tableDetailsCore;
const input = () => {
  const r = parseDestInput(tab, {
    ref: "WR-atami-008",
    core: { kind: "museum", region_id: "atami" },
    texts: [{ lang: "ja", name: "資料館" }],
    details: {
      fees: [{ amount: 500, currency: "JPY" }, { amount: 300, currency: "JPY" }],
      hours: [{ open_time: "09:00" }],
    },
    categories: ["onsen", "bbq"],
    photos: [{ storage_key: "a.jpg" }, { storage_key: "b.jpg" }],
  });
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.value;
};
let n = 0;
const ctx = () => ({ userId: "u1", keyId: "k1", uuid: () => `id-${++n}` });
const refs = (over: Partial<DestRefs> = {}): DestRefs => ({
  destByRef: new Map(),
  slugs: new Set(),
  regions: new Set(),
  categories: new Set(["onsen"]),
  ...over,
});

describe("planDestWrite", () => {
  it("表の順・親の id・sort・dest_id", () => {
    n = 0;
    const p = planDestWrite(tab, input(), refs(), ctx());
    const names = p.tables.map((t) => t.table);
    expect(names).toEqual(["fake_cores", "fake_texts", "fake_hours", "fake_fees", "dest_photos"]);
    const t = (name: string) => p.tables.find((x) => x.table === name)!.rows;
    const destId = p.destination.dest_id;
    for (const x of p.tables) for (const r of x.rows) expect(r.dest_id).toBe(destId);
    const fees = t("fake_fees");
    expect(fees.map((r) => [r.sort, r.amount])).toEqual([[0, "500"], [1, "300"]]);
    expect(t("dest_photos").map((r) => r.sort)).toEqual([0, 1]);
    expect(p.destination.slug).toBe("wr-atami-008");
    expect(p.categories).toEqual([{ id: "bbq", name: { ja: "bbq" } }]);
    expect(p.regions).toEqual([{ id: "atami", name: { ja: "atami" } }]);
    expect(p.dest_categories).toHaveLength(2);
    expect(p.import).toMatchObject({ ref: "WR-atami-008", collector_key_id: "k1" });
  });

  it("slug が重なると -2 -3", () => {
    const p = planDestWrite(tab, input(), refs({ slugs: new Set(["wr-atami-008", "wr-atami-008-2"]) }), ctx());
    expect(p.destination.slug).toBe("wr-atami-008-3");
  });

  it("既存の ref は dest_id と slug を使い回す", () => {
    const p = planDestWrite(
      tab,
      input(),
      refs({ destByRef: new Map([["WR-atami-008", { destId: "old", slug: "keep-me" }]]), slugs: new Set(["keep-me"]) }),
      ctx(),
    );
    expect(p.destination).toMatchObject({ dest_id: "old", slug: "keep-me" });
    expect(p.tables[0].rows[0].dest_id).toBe("old");
  });

  it("写真の room は subject_key に入る（room の列は渡さない）", () => {
    const i = input();
    i.photos = [{ storage_key: "a.jpg", room: "r1" }, { storage_key: "b.jpg" }];
    const rows = planDestWrite(tab, i, refs(), ctx()).tables.find((x) => x.table === "dest_photos")!.rows;
    expect(rows[0]).toMatchObject({ subject_key: "r1", storage_key: "a.jpg" });
    expect(rows[0]).not.toHaveProperty("room");
    expect(rows[1]).not.toHaveProperty("subject_key");
  });

  it("detailsSchema を持つコアは details をコアの行に入れ、詳細の表を作らない", () => {
    const r = parseDestInput(jsonDetailsCore, {
      ref: "WR-json-001",
      core: { kind: "hotel" },
      texts: [{ lang: "ja", name: "宿" }],
      details: { rooms: [{ key: "r1" }] },
      photos: [{ storage_key: "a.jpg", room: "r1" }],
    });
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const p = planDestWrite(jsonDetailsCore, r.value, refs(), ctx());
    expect(p.tables.map((t) => t.table)).toEqual(["accommodations", "accommodation_texts", "dest_photos"]);
    expect(p.tables[0].rows[0]).toMatchObject({ kind: "hotel", details: { rooms: [{ key: "r1" }] } });
    expect(p.tables[2].rows[0]).toMatchObject({ subject_key: "r1" });
    const none = planDestWrite(jsonDetailsCore, { ...r.value, details: undefined }, refs(), ctx());
    expect(none.tables[0].rows[0].details).toBeNull();
  });

  it("detailsSchema の無いコアの行に details の列は出ない", () => {
    expect(planDestWrite(tab, input(), refs(), ctx()).tables[0].rows[0]).not.toHaveProperty("details");
  });

  it.each([
    ["experience", withExperienceQuality, ["experiences", "experience_texts", "dest_photos"]],
    ["nature", withNatureQuality, ["natures", "nature_texts", "dest_photos"]],
    ["building", withBuildingQuality, ["buildings", "building_texts", "dest_photos"]],
    ["hotspring", withHotspringQuality, ["hotsprings", "hotspring_texts", "dest_photos"]],
    ["village", withVillageQuality, ["villages", "village_texts", "dest_photos"]],
  ] as const)("%s は details をコアの行に入れ、旧い詳細の表を作らない", (type, make, tables) => {
    const core = coreByType(type)!;
    const kind = { experience: "tour", nature: "coast", building: "museum", hotspring: "day_use", village: "onsen_town" }[type];
    const r = parseDestInput(core, make({ ref: `WR-${type}-001`, core: { kind } }));
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const p = planDestWrite(core, r.value, refs(), ctx());
    expect(p.tables.map((t) => t.table)).toEqual(tables);
    expect(p.tables[0].rows[0].details).toEqual(r.value.details);
  });

  it("宿は details を accommodations の行に入れ、accommodation_* の詳細の表を作らない", () => {
    const r = parseDestInput(acc, withAccommodationQuality({ ref: "WR-atami-009", core: { kind: "hotel", region_id: "atami" }, photos: [{ storage_key: "a.jpg", room: "main" }] }));
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const p = planDestWrite(acc, r.value, refs(), ctx());
    expect(p.tables.map((t) => t.table)).toEqual(["accommodations", "accommodation_texts", "dest_photos"]);
    expect(p.tables[0].rows[0].details).toEqual(r.value.details);
    expect(p.tables[0].rows[0]).toMatchObject({ details: { rooms: [{ key: "main", capacity: 2 }] } });
    expect(p.tables[2].rows[0]).toMatchObject({ subject_key: "main" });
  });
});
