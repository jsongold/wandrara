import { describe, expect, it } from "vitest";
import { areaTraitsOf, type TraitRow } from "./area-traits.ts";

const trait = (id: string, source: "items" | "geo", category_ids: string[] | null, sort: number): TraitRow => ({
  id, name: { ja: id.toUpperCase(), en: id }, icon: "tag", sort, source, category_ids,
});

describe("areaTraitsOf", () => {
  const traits = [trait("onsen", "items", ["onsen", "onsentown"], 10), trait("lake", "items", ["lake"], 20), trait("sea", "geo", null, 5), trait("hike", "items", ["hike"], 30)];
  // DB の area_item_traits() の結果（エリア → 分類から付いた特性）。マスターに無い特性（old）は無視する
  const items = { gora: ["lake", "onsen"], ito: ["onsen"], nowhere: ["old"] };
  const got = areaTraitsOf(traits, [{ region_id: "ito", trait_id: "sea", value: 1 }, { region_id: "gora", trait_id: "sea", value: 0 }], items, "ja");

  it("DB が返した宿・体験の分類由来の特性がエリアに付く。土地由来は値が 0 より大きいものだけ", () => {
    expect(got.byRegion).toEqual({ gora: ["lake", "onsen"], ito: ["onsen", "sea"] });
  });
  it("エリアに付いた特性だけを sort 順に並べ、名前は言語で選ぶ", () => {
    expect(got.traits.map((t) => [t.id, t.label])).toEqual([["sea", "SEA"], ["onsen", "ONSEN"], ["lake", "LAKE"]]);
  });
});
