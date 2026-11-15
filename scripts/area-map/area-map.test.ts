import { describe, expect, it } from "vitest";
import { AREA_PARTS, AREA_POINTS, MAPS } from "./areas.ts";
import { featuresFor, sourceCodes, type FeatureCollection } from "./parts.ts";
import { makeProjection, pathOf } from "./project.ts";

const square = (x: number, y: number, s = 0.01) => ({
  type: "Polygon",
  coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});
const fc = (features: { props: Record<string, unknown>; geom: unknown }[]): FeatureCollection => ({
  type: "FeatureCollection",
  features: features.map((f) => ({ type: "Feature", properties: f.props, geometry: f.geom })),
});

describe("makeProjection / pathOf", () => {
  const pr = makeProjection([139, 35, 139.1, 35.1], 100);

  it("範囲の左上が 0,0、右端が幅になる", () => {
    expect(pr.project([139, 35.1])).toEqual([0, 0]);
    expect(pr.project([139.1, 35])[0]).toBe(100);
  });

  it("範囲内の輪は M..Z の path になる", () => {
    expect(pathOf(square(139.02, 35.02, 0.02), pr)).toMatch(/^M[\d.,L]+Z$/);
  });

  it("範囲外の輪と、丸めて潰れた輪は捨てる", () => {
    expect(pathOf(square(140, 36), pr)).toBe("");
    expect(pathOf(square(139.05, 35.05, 0.00001), pr)).toBe("");
  });
});

describe("featuresFor", () => {
  const src = {
    n03: fc([{ props: { N03_007: "22208" }, geom: square(139.1, 34.9) }, { props: { N03_007: "99999" }, geom: square(0, 0) }]),
    estat: {
      "22222": fc([
        { props: { S_NAME: "修善寺", S_AREA: "017000" }, geom: square(138.9, 34.97) },
        { props: { S_NAME: "冷川", S_AREA: "096000" }, geom: square(139, 34.95) },
      ]),
    },
  };
  const parts = {
    ito: [{ n03: "22208" }],
    shuzenji: [{ estat: "22222", codeRange: [11, 52] as [number, number] }],
    hiekawa: [{ estat: "22222", names: ["冷川"] }],
  };

  it("市区町村コード・コード範囲・名前でエリアに割り当てる", () => {
    const out = featuresFor(["ito", "shuzenji", "hiekawa"], parts, src);
    expect(out.map((f) => f.properties.area)).toEqual(["ito", "shuzenji", "hiekawa"]);
  });

  it("定義の無いエリアと、形が見つからないエリアはエラー", () => {
    expect(() => featuresFor(["nope"], parts, src)).toThrow(/エリア定義/);
    expect(() => featuresFor(["x"], { x: [{ n03: "00000" }] }, src)).toThrow(/見つかりません/);
  });

  it("使う元データのコードを集める", () => {
    expect(sourceCodes(["ito", "shuzenji"], parts)).toEqual({ n03: ["22208"], estat: ["22222"] });
  });
});

describe("エリア定義", () => {
  const ids = new Set(MAPS.map((m) => m.id));

  it("地図で使うエリアはすべて定義されている", () => {
    for (const m of MAPS) {
      for (const id of [...(m.shapes ?? []), ...(m.links ?? []).flatMap((l) => (l.shape ? [l.shape] : []))]) expect(AREA_PARTS[id], id).toBeDefined();
      for (const id of m.points ?? []) expect(AREA_POINTS[id], id).toBeDefined();
    }
  });

  it("寄る先の地図が存在する", () => {
    for (const m of MAPS) for (const l of m.links ?? []) expect(ids.has(l.map), l.map).toBe(true);
  });
});
