import { describe, expect, it } from "vitest";
import { filterAreas } from "./area-filter.ts";

const parentOf = { a: null, b: "a", c: "a", d: null };
const byRegion = { b: ["onsen", "sea"], c: ["onsen"], d: ["sea"] };

describe("filterAreas", () => {
  it("何も選ばなければ null", () => {
    expect(filterAreas(byRegion, [], parentOf)).toBeNull();
  });
  it("合うエリアと、その親を返す", () => {
    expect(filterAreas(byRegion, ["onsen"], parentOf)).toEqual(new Set(["b", "c", "a"]));
  });
  it("複数選ぶと AND", () => {
    expect(filterAreas(byRegion, ["onsen", "sea"], parentOf)).toEqual(new Set(["b", "a"]));
  });
  it("合うものが無ければ空", () => {
    expect(filterAreas(byRegion, ["ski"], parentOf)).toEqual(new Set());
  });
});
