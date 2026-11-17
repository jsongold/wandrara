import { describe, expect, it } from "vitest";
import { buildNearby, distanceM, EXTENT, H, pathData, sourcesOf, tilesAround, toWorld, W, type MapFeature } from "./build";
import { nearbyMap } from "./spec";

const ALL = nearbyMap().green().water().roads().rail().stations({ limit: 3 }).spec;

const lat = 35.2329;
const lng = 139.1069;
const c = toWorld(lat, lng);
const at = (dx: number, dy: number) => ({ x: c.x + dx, y: c.y + dy });
const station = (name: string, dx: number, extra: Record<string, unknown> = {}): MapFeature => ({
  layer: "poi",
  type: 1,
  props: { class: "railway", subclass: "station", name, "name:ja": name, "name:en": `${name}-en`, ...extra },
  geometry: [[at(dx, 0)]],
});

describe("tilesAround", () => {
  it("点のいる区画と、点に近い側の隣を 2×2 で返す", () => {
    const t = tilesAround(lat, lng);
    const tx = Math.floor(c.x / EXTENT);
    const ty = Math.floor(c.y / EXTENT);
    expect(t).toHaveLength(4);
    expect(t[0]).toEqual({ x: tx, y: ty });
    expect(new Set(t.map((p) => p.x)).size).toBe(2);
    expect(new Set(t.map((p) => p.y)).size).toBe(2);
  });
});

describe("pathData", () => {
  it("ほぼ一直線の点を間引き、枠から遠い線を落とし、面は Z で閉じる", () => {
    expect(pathData([[{ x: 0, y: 0 }, { x: 5, y: 0.2 }, { x: 10, y: 0 }, { x: 10, y: 10 }]], true)).toBe("M0 0L10 0L10 10Z");
    expect(pathData([[{ x: -500, y: 0 }, { x: -400, y: 0 }, { x: -300, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }]], false)).toBe("M-300 0L10 0L20 5");
    expect(pathData([[{ x: 0, y: 0 }]], false)).toBe("");
  });
});

describe("distanceM", () => {
  it("緯度 0.01 度はおよそ 1.1km", () => {
    expect(Math.round(distanceM({ lat: 35, lng: 139 }, { lat: 35.01, lng: 139 }) / 10)).toBe(111);
  });
});

describe("buildNearby", () => {
  it("点は枠のまんなか", () => {
    expect(buildNearby([], lat, lng, "ja", ALL).point).toEqual({ x: W / 2, y: H / 2 });
  });

  it("駅は近い順に 3 件まで。信号場は出さず、同じ名前は 1 つにする", () => {
    const fs = [station("C", 900), station("A", 100), station("B", 300), station("A", 120), station("D", 1200), station("出山信号場", 50, { subclass: "halt" })];
    const s = buildNearby(fs, lat, lng, "ja", ALL).places[0].items;
    expect(s.map((x) => x.name)).toEqual(["A", "B", "C"]);
    expect(s[0].distanceM).toBeLessThan(s[1].distanceM);
  });

  it("英語では name:en を使う", () => {
    expect(buildNearby([station("A", 100)], lat, lng, "en", ALL).places[0].items[0].name).toBe("A-en");
  });

  it("道は縁取りと本体の 2 本、小道は出さない。枠から遠い線は落とす", () => {
    const line = (cls: string, dy = 0): MapFeature => ({ layer: "transportation", type: 2, props: { class: cls }, geometry: [[at(-500, dy), at(500, dy)]] });
    const r = buildNearby([line("secondary"), line("path"), line("minor", 100000)], lat, lng, "ja", ALL);
    expect(r.paths.map((p) => p.key)).toEqual(["roadCasing", "roadMajor"]);
  });

  it("呼ばなかったメソッドのものは描かず、その層も読まない", () => {
    const rail: MapFeature = { layer: "transportation", type: 2, props: { class: "rail" }, geometry: [[at(-500, 0), at(500, 0)]] };
    const spec = nearbyMap().green().water().spec;
    const r = buildNearby([rail, station("A", 100)], lat, lng, "ja", spec);
    expect(r.paths).toEqual([]);
    expect(r.places).toEqual([]);
    expect(sourcesOf(spec)).toEqual(["landcover", "park", "water", "waterway"]);
    expect(sourcesOf(nearbyMap().rail().stations().spec)).toEqual(["transportation", "poi"]);
  });

  it("呼んだ順に下から重ねる", () => {
    const f = (layer: string, cls: string, type = 3): MapFeature => ({ layer, type, props: { class: cls }, geometry: [[at(-100, -100), at(100, -100), at(100, 100)]] });
    const fs = [f("water", "lake"), f("landcover", "wood")];
    expect(buildNearby(fs, lat, lng, "ja", nearbyMap().water().green().spec).paths.map((p) => p.key)).toEqual(["water", "green"]);
    expect(buildNearby(fs, lat, lng, "ja", nearbyMap().green().water().spec).paths.map((p) => p.key)).toEqual(["green", "water"]);
  });
});
