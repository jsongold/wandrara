import { describe, expect, it } from "vitest";
import type { RegionDef, RegionPart } from "../../src/lib/region/types.ts";
import { mappable, toDefinitions } from "./definitions.ts";
import { citiesOf, featuresOf, type FeatureCollection } from "./parts.ts";
import { deriveMapTree, intervalFor, name2, pad } from "./tree.ts";
import { buildLookup } from "./write.ts";
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

const n03 = (code: string): RegionPart => ({ source: "n03", version: "N03-2024", code });
const est = (code: string): RegionPart => ({ source: "estat", version: "estat-2020", code });

describe("featuresOf / citiesOf", () => {
  const src = {
    n03: fc([{ props: { N03_007: "22208" }, geom: square(139.1, 34.9) }]),
    estat: { "22222": fc([{ props: { KEY_CODE: "222220110" }, geom: square(138.9, 34.97) }]) },
  };
  it("材料 1 行ずつ元データに当て、エリア id を付ける", () => {
    expect(featuresOf("ito", [n03("22208")], src).map((f) => f.properties.area)).toEqual(["ito"]);
    expect(featuresOf("shuzenji", [est("222220110")], src)).toHaveLength(1);
  });
  it("元データに無い材料は失敗（版の違い・合併）", () => {
    expect(() => featuresOf("x", [n03("22208"), n03("00000")], src)).toThrow(/材料がありません/);
    expect(() => featuresOf("x", [est("222229999")], src)).toThrow(/材料がありません/);
  });
  it("使う市区町村（estat は KEY_CODE の先頭 5 桁）", () => {
    expect(citiesOf([n03("22208"), est("222220110")])).toEqual({ all: ["22208", "22222"], estat: ["22222"] });
  });
});

describe("toDefinitions", () => {
  const row = (id: string, parent_id: string | null, extra: Partial<{ lat: number; lng: number }> = {}) => ({
    id, parent_id, name: { ja: id }, sort: null, lat: extra.lat ?? null, lng: extra.lng ?? null,
  });
  it("材料と点を定義にまとめ、材料も点も無いエリアは地図に出さない", () => {
    const defs = toDefinitions(
      [row("hakone", null), row("gora", "hakone"), row("owakudani", "hakone", { lat: 35.24, lng: 139.02 }), row("auto", null)],
      [{ region_id: "gora", source: "estat", source_version: "estat-2020", code: "143820010" }],
    );
    expect(defs.find((d) => d.id === "owakudani")?.point).toEqual([139.02, 35.24]);
    expect(mappable(defs).map((d) => d.id).sort()).toEqual(["gora", "hakone", "owakudani"]);
  });
  it("3 段以上・無い親・版違いは失敗", () => {
    expect(() => toDefinitions([row("a", null), row("b", "a"), row("c", "b")], [])).toThrow(/3 段/);
    expect(() => toDefinitions([row("a", "zz")], [])).toThrow(/親がありません/);
    expect(() => toDefinitions([row("a", null)], [{ region_id: "a", source: "n03", source_version: "N03-2020", code: "1" }])).toThrow(/版が違います/);
  });
});

describe("deriveMapTree", () => {
  const def = (id: string, parentId: string | null, parts: RegionPart[] = [], point: [number, number] | null = null): RegionDef => ({
    id, parentId, name: { ja: id }, sort: null, point, parts,
  });
  // 箱根（小さい親・神奈川）と伊豆（大きい親・静岡）。地方をまたいで隣り合う
  const defs = [
    def("hakone", null, [n03("14382")]),
    def("gora", "hakone", [est("143820010")]),
    def("owakudani", "hakone", [], [139.02, 35.24]),
    def("izu", null, [n03("22205")]),
    def("ito", "izu", [n03("22208")]),
  ];
  const bbox = new Map<string, [number, number, number, number]>([
    ["hakone", [138.98, 35.17, 139.13, 35.29]],
    ["gora", [139.03, 35.23, 139.06, 35.26]],
    ["owakudani", [139.02, 35.24, 139.02, 35.24]],
    ["izu", [138.7, 34.6, 139.2, 35.16]],
    ["ito", [139.0, 34.85, 139.2, 35.05]],
  ]);
  const cities = new Map([
    ["hakone", ["14382"]],
    ["izu", ["22205", "22208"]],
  ]);
  const maps = deriveMapTree({ defs, bbox, cities });
  const byId = new Map(maps.map((m) => [m.id, m]));

  it("日本 → エリアのある地方だけ。地方の地図は中心がその範囲に入る親を出し、子のある親は自分の地図へ寄る", () => {
    expect(byId.get("japan")?.links).toEqual([{ map: "chiho-kanto", chiho: "kanto" }, { map: "chiho-chubu", chiho: "chubu" }]);
    expect(byId.get("chiho-kanto")).toMatchObject({ links: [{ map: "hakone", shape: "hakone" }], shapes: [], wholes: [] });
    expect(byId.get("chiho-chubu")).toMatchObject({ links: [{ map: "izu", shape: "izu" }], wholes: [] });
  });
  it("親の地図には子と、親自身の材料（子に入らない残り）を出す", () => {
    expect(byId.get("hakone")).toMatchObject({ shapes: ["gora", "hakone"], points: ["owakudani"], wholes: ["hakone"] });
    expect(byId.get("izu")).toMatchObject({ shapes: ["ito", "izu"], wholes: ["izu"] });
  });
  it("地方の本土の範囲が渡されれば、それを使う（離島で広がらない）", () => {
    const m = deriveMapTree({ defs, bbox, cities, chihoView: new Map([["kanto", [138.9, 34.5, 140.9, 37.0] as [number, number, number, number]]]) });
    const k = m.find((x) => x.id === "chiho-kanto")!;
    expect(k.bbox[0]).toBeLessThan(138.9);
    expect(k.links.map((l) => l.map)).toEqual(["hakone", "izu"]); // 伊豆の中心も入る
  });
  it("範囲は幅ゼロにならず、間隔は範囲の幅で決まる", () => {
    const b = pad([139, 35, 139, 35], 0.1);
    expect(b[2] - b[0]).toBeGreaterThan(0.02);
    expect(intervalFor([138.68, 34.58, 139.22, 35.33])).toBe(500);
    expect(intervalFor([138.96, 35.165, 139.135, 35.3])).toBe(100);
  });
  it("名前は ja・en をそろえる（無い en は ja）", () => {
    expect(name2({ ja: "箱根" }, "hakone")).toEqual({ ja: "箱根", en: "箱根" });
    expect(name2({}, "x")).toEqual({ ja: "x", en: "x" });
  });
});

describe("buildLookup", () => {
  const feat = (props: Record<string, unknown>, x: number) => ({ type: "Feature" as const, properties: props, geometry: square(x, 0, 1) });
  it("県ごとに市区町村・エリアの材料・市区町村 → エリアをまとめ、版は中身で決まる", () => {
    const defs: RegionDef[] = [
      { id: "izu", parentId: null, name: { ja: "伊豆" }, sort: null, point: null, parts: [n03("22205")] },
      { id: "shuzenji", parentId: "izu", name: { ja: "修善寺" }, sort: null, point: null, parts: [est("222220110")] },
    ];
    const n03f = [feat({ N03_007: "22205", N03_001: "静岡県", N03_004: "熱海市" }, 0), feat({ N03_007: "22222", N03_001: "静岡県", N03_004: "伊豆市" }, 1)];
    const a = buildLookup({ defs, n03: n03f, estat: { "22222": [feat({ KEY_CODE: "222220110" }, 1)] } });
    expect(a.shards).toHaveLength(1);
    expect(a.shards[0].codeAreas).toEqual({ "22205": ["izu"], "22222": ["shuzenji"] });
    expect(a.shards[0].areas.map((x) => [x.id, x.municipalities, x.shape.length])).toEqual([["izu", ["22205"], 0], ["shuzenji", [], 1]]);
    expect(a.manifest.prefectures).toEqual([{ code: "22", name: "静岡県", bbox: [0, 0, 2, 1] }]);
    expect(a.manifest.parents).toEqual({ izu: null, shuzenji: "izu" });
    const b = buildLookup({ defs, n03: n03f, estat: { "22222": [feat({ KEY_CODE: "222220110" }, 1)] } });
    expect(b.manifest.version).toBe(a.manifest.version);
  });
});
