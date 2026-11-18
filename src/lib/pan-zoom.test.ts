import { describe, expect, it } from "vitest";
import { clampView, fitView, MAX_ZOOM, toScreen, panBy, parseView, toView, viewString, zoomAt, shownView } from "./pan-zoom.ts";

const full = parseView("0 0 360 520");

describe("pan-zoom", () => {
  it("枠の縦横比が viewBox と違うと、見えている範囲は viewBox より広い", () => {
    expect(shownView({ x: 0, y: 0, w: 100, h: 100 }, { w: 200, h: 100 })).toEqual({ x: -50, y: 0, w: 200, h: 100 });
    expect(shownView({ x: 0, y: 0, w: 100, h: 100 }, { w: 100, h: 100 })).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it("viewBox の文字列と行き来できる", () => {
    expect(viewString(parseView("1 2 3 4"))).toBe("1 2 3 4");
  });
  it("動かすと表示が逆向きにずれ、中心は全体の外に出ない", () => {
    const v = { x: 100, y: 100, w: 100, h: 100 };
    expect(panBy(v, 10, -5, full)).toEqual({ x: 90, y: 105, w: 100, h: 100 });
    const far = panBy(v, 1000, 1000, full);
    expect(far.x + far.w / 2).toBe(0);
    expect(far.y + far.h / 2).toBe(0);
  });
  it("寄せても指の下の点は動かない。寄り・引きには上限がある", () => {
    const v = { x: 0, y: 0, w: 360, h: 520 };
    const z = zoomAt(v, 90, 130, 2, full);
    expect(z).toEqual({ x: 45, y: 65, w: 180, h: 260 });
    expect(zoomAt(v, 180, 260, MAX_ZOOM * 10, full).w).toBeCloseTo(360 / MAX_ZOOM);
    expect(clampView({ x: 0, y: 0, w: 1000, h: 1444 }, full).w).toBe(360);
  });
  it("縦に余白がある枠でも、px を viewBox の座標にする", () => {
    const v = { x: 0, y: 0, w: 100, h: 100 };
    const p = toView(v, { w: 200, h: 400 }, 100, 200); // 枠の真ん中
    expect(p).toEqual({ x: 50, y: 50, unit: 0.5 });
  });
  it("toScreen は toView の逆", () => {
    const v = { x: 10, y: 20, w: 100, h: 100 };
    const box = { w: 200, h: 400 };
    const m = toView(v, box, 70, 300);
    const [sx, sy] = toScreen(v, box, m.x, m.y);
    expect(sx).toBeCloseTo(70);
    expect(sy).toBeCloseTo(300);
  });
  it("fitView は中心を合わせ、枠と同じ縦横比で、幅は maxW まで", () => {
    const box = { w: 200, h: 400 };
    const small = fitView([100, 100, 2, 2], box, 20);
    expect(small.w).toBeCloseTo(2.5);
    expect(small.h).toBeCloseTo(5);
    expect(small.x + small.w / 2).toBeCloseTo(101);
    expect(small.y + small.h / 2).toBeCloseTo(101);
    const big = fitView([0, 0, 100, 100], box, 1000);
    expect(big.w).toBeCloseTo(125); // 横 100*1.25 が効く（縦は余る）
    expect(big.w / big.h).toBeCloseTo(0.5);
  });
});
