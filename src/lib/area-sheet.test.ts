import { describe, expect, it } from "vitest";
import { areaLabelOf, listAreas } from "./area-sheet";
import type { Region } from "./types";

const regions: Region[] = [
  { id: "hakone", parentId: null, name: { ja: "箱根", en: "Hakone" }, sort: 0 },
  { id: "gora", parentId: "hakone", name: { ja: "強羅" }, sort: 0 },
  { id: "izu", parentId: null, name: { ja: "伊豆", en: "Izu" }, sort: 0 },
];

describe("listAreas", () => {
  it("親なしのエリアと、その直下の地区を言語で返す（英語が無ければ日本語）", () => {
    expect(listAreas(regions, "ja")).toEqual([
      { id: "hakone", label: "箱根", subs: [{ id: "gora", label: "強羅" }] },
      { id: "izu", label: "伊豆", subs: [] },
    ]);
    expect(listAreas(regions, "en")[0]).toEqual({ id: "hakone", label: "Hakone", subs: [{ id: "gora", label: "強羅" }] });
  });
});

describe("areaLabelOf", () => {
  it("親・地区のどちらも名前を返す。all・知らない id は null", () => {
    expect(areaLabelOf(regions, "gora", "ja")).toBe("強羅");
    expect(areaLabelOf(regions, "izu", "en")).toBe("Izu");
    expect(areaLabelOf(regions, "all", "ja")).toBeNull();
    expect(areaLabelOf(regions, "nowhere", "ja")).toBeNull();
  });
});
