import { describe, expect, it } from "vitest";
import { CHILD_ZOOM } from "./area-map.ts";
import { showChildren, visibleParents } from "./area-map-visible.ts";

const start = { x: 0, y: 0, w: 360, h: 520 };

describe("area-map-visible", () => {
  it("開いた幅の 1/CHILD_ZOOM 以下に寄ると子を出す", () => {
    expect(showChildren(start, start)).toBe(false);
    expect(showChildren({ ...start, w: start.w / CHILD_ZOOM }, start)).toBe(true);
  });
  it("子を出している間は、少し引いても子のまま", () => {
    const w = (start.w / CHILD_ZOOM) * 1.1;
    expect(showChildren({ ...start, w }, start)).toBe(false);
    expect(showChildren({ ...start, w }, start, true)).toBe(true);
    expect(showChildren({ ...start, w: (start.w / CHILD_ZOOM) * 1.2 }, start, true)).toBe(false);
  });
  it("表示範囲と重なる親だけ返す", () => {
    const view = { x: 0, y: 0, w: 100, h: 100 };
    const parents = [
      { id: "in", box: [50, 50, 100, 100] as [number, number, number, number] },
      { id: "out", box: [200, 0, 10, 10] as [number, number, number, number] },
      { id: "edge", box: [100, 0, 10, 10] as [number, number, number, number] },
    ];
    expect(visibleParents(parents, view)).toEqual(["in"]);
  });
});
