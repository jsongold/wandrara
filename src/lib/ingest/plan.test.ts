import { describe, expect, it } from "vitest";
import { parseDestInput } from "./bundle.ts";
import { coreByType } from "./cores.ts";
import { planDestWrite, type DestRefs } from "./plan.ts";

const acc = coreByType("accommodation")!;
const input = () => {
  const r = parseDestInput(acc, {
    ref: "WR-atami-008",
    core: { kind: "private_rental", region_id: "atami" },
    texts: [{ lang: "ja", name: "ヴィラ" }],
    details: {
      units: [
        { capacity: 4, bedrooms: [{ beds: [{ bed_type: "double", count: 2 }, { bed_type: "single", count: 1 }] }] },
        { capacity: 2 },
      ],
      baths: [{ kind: "private" }],
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
    const p = planDestWrite(acc, input(), refs(), ctx());
    const names = p.tables.map((t) => t.table);
    expect(names).toEqual([
      "accommodations",
      "accommodation_texts",
      "accommodation_units",
      "accommodation_bedrooms",
      "accommodation_beds",
      "accommodation_baths",
      "dest_photos",
    ]);
    const t = (name: string) => p.tables.find((x) => x.table === name)!.rows;
    const destId = p.destination.dest_id;
    for (const x of p.tables) for (const r of x.rows) expect(r.dest_id).toBe(destId);
    const units = t("accommodation_units");
    expect(units.map((u) => u.sort)).toEqual([0, 1]);
    expect(units[0]).not.toHaveProperty("bedrooms");
    const bedrooms = t("accommodation_bedrooms");
    expect(bedrooms[0].unit_id).toBe(units[0].id);
    const beds = t("accommodation_beds");
    expect(beds.map((b) => [b.bedroom_id, b.sort])).toEqual([[bedrooms[0].id, 0], [bedrooms[0].id, 1]]);
    expect(t("dest_photos").map((r) => r.sort)).toEqual([0, 1]);
    expect(p.destination.slug).toBe("wr-atami-008");
    expect(p.categories).toEqual([{ id: "bbq", name: { ja: "bbq" } }]);
    expect(p.regions).toEqual([{ id: "atami", name: { ja: "atami" } }]);
    expect(p.dest_categories).toHaveLength(2);
    expect(p.import).toMatchObject({ ref: "WR-atami-008", collector_key_id: "k1" });
  });

  it("slug が重なると -2 -3", () => {
    const p = planDestWrite(acc, input(), refs({ slugs: new Set(["wr-atami-008", "wr-atami-008-2"]) }), ctx());
    expect(p.destination.slug).toBe("wr-atami-008-3");
  });

  it("既存の ref は dest_id と slug を使い回す", () => {
    const p = planDestWrite(
      acc,
      input(),
      refs({ destByRef: new Map([["WR-atami-008", { destId: "old", slug: "keep-me" }]]), slugs: new Set(["keep-me"]) }),
      ctx(),
    );
    expect(p.destination).toMatchObject({ dest_id: "old", slug: "keep-me" });
    expect(p.tables[0].rows[0].dest_id).toBe("old");
  });
});
