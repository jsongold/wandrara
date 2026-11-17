import { describe, expect, it } from "vitest";
import { nearbyMap } from "./spec";
import { filterStyle, type Style } from "./style";

const layer = (id: string, type = "line", source = "openmaptiles", layout?: Record<string, unknown>) => ({ id, type, source, ...(layout ? { layout } : {}) });
const style: Style = {
  version: 8,
  sources: { openmaptiles: { type: "vector" }, ne2_shaded: { type: "raster" } },
  layers: [
    { id: "background", type: "background" },
    layer("natural_earth", "raster", "ne2_shaded"),
    layer("park", "fill"),
    layer("landcover_wood", "fill"),
    layer("water", "fill"),
    layer("waterway_river"),
    layer("road_minor"),
    layer("bridge_motorway"),
    layer("road_major_rail"),
    layer("tunnel_transit_rail"),
    layer("building", "fill"),
    layer("building-3d", "fill-extrusion"),
    layer("boundary_2"),
    layer("highway-shield-non-us", "symbol", "openmaptiles", { "text-field": "{ref}" }),
    layer("poi_r1", "symbol", "openmaptiles", { "text-field": "{name}" }),
    layer("poi_transit", "symbol", "openmaptiles", { "text-field": "{name}" }),
    layer("label_town", "symbol", "openmaptiles", { "text-field": "{name}" }),
  ],
};
const ids = (s: Style) => s.layers.map((l) => l.id);

describe("filterStyle", () => {
  it("呼んだメソッドの層と背景だけ残す。境界線・3D・広域の陰影は出さない", () => {
    const s = filterStyle(style, nearbyMap().green().water().roads().rail().buildings().placeNames().stations().pois().spec.groups, "ja");
    expect(ids(s)).toEqual([
      "background", "park", "landcover_wood", "water", "waterway_river", "road_minor", "bridge_motorway",
      "road_major_rail", "tunnel_transit_rail", "building", "highway-shield-non-us", "poi_r1", "poi_transit", "label_town",
    ]);
    expect(Object.keys(s.sources)).toEqual(["openmaptiles"]);
  });

  it("メソッドを外すとその層が消える（道と線路は分かれる）", () => {
    expect(ids(filterStyle(style, nearbyMap().roads().spec.groups, "ja"))).toEqual(["background", "road_minor", "bridge_motorway", "highway-shield-non-us"]);
    expect(ids(filterStyle(style, nearbyMap().rail().stations().spec.groups, "ja"))).toEqual(["background", "road_major_rail", "tunnel_transit_rail", "poi_transit"]);
  });

  it("名前は表示の言語で出す。道の番号はそのまま", () => {
    const s = filterStyle(style, nearbyMap().roads().stations().spec.groups, "en");
    const field = (id: string) => s.layers.find((l) => l.id === id)?.layout?.["text-field"];
    expect(field("poi_transit")).toEqual(["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]]);
    expect(field("highway-shield-non-us")).toBe("{ref}");
    expect(filterStyle(style, ["stations"], "ja").layers.find((l) => l.id === "poi_transit")?.layout?.["text-field"]).toEqual([
      "coalesce", ["get", "name:ja"], ["get", "name"],
    ]);
  });
});
