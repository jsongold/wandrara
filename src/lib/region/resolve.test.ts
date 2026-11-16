import { describe, expect, it } from "vitest";
import { FIXTURE_MANIFEST as M, FIXTURE_SHARD as S } from "./fixtures.ts";
import { candidatePrefectures, commonAncestor, decideRegion, inShape, resolveRegion } from "./resolve.ts";
import { representativeLocation } from "./representative.ts";
import type { RepresentativeLocation } from "./types.ts";

const at = (lng: number, lat: number, precision: RepresentativeLocation["precision"] = "exact"): RepresentativeLocation => ({
  lat,
  lng,
  precision,
  prefecture: null,
  municipality: null,
});
const resolve = (loc: RepresentativeLocation) => resolveRegion(loc, [S], M);

describe("inShape", () => {
  it("穴の中は外、穴の線の上と外周の線の上は中", () => {
    const shape = S.municipalities[1].shape;
    expect(inShape([3.2, 0.7], shape)).toBe(false);
    expect(inShape([3, 0.7], shape)).toBe(true);
    expect(inShape([2, 1], shape)).toBe(true);
    expect(inShape([2.2, 5.2], shape)).toBe(true); // 離島
  });
});

describe("resolveRegion：正確な位置", () => {
  it("子の中は子、子に入らない親の中は親", () => {
    expect(resolve(at(0.5, 0.5))).toEqual({ ok: true, regionId: "h1", by: "point" });
    expect(resolve(at(1.5, 1.5))).toEqual({ ok: true, regionId: "h", by: "point" });
    expect(resolve(at(7.5, 1))).toEqual({ ok: true, regionId: "i", by: "point" });
  });
  it("兄弟の境界の上は共通の親", () => {
    expect(resolve(at(1, 0.5))).toEqual({ ok: true, regionId: "h", by: "point" });
  });
  it("離島も子、穴（飛び地）は別のエリア", () => {
    expect(resolve(at(2.2, 5.2))).toEqual({ ok: true, regionId: "i1", by: "point" });
    expect(resolve(at(3.2, 0.7))).toEqual({ ok: true, regionId: "b", by: "point" });
  });
  it("別の親どうしが重なるところは決まらない、海の上は外", () => {
    expect(resolve(at(5.2, 1.2))).toEqual({ ok: false, reason: "ambiguous" });
    expect(resolve(at(0.5, 4))).toEqual({ ok: false, reason: "outside" });
  });
  it("street・district も座標で子まで", () => {
    expect(resolve(at(6.5, 1, "district"))).toEqual({ ok: true, regionId: "i2", by: "point" });
  });
  it("点だけのエリア（hp）は選ばれない", () => {
    expect(resolve(at(0.5, 0.5)).ok && resolve(at(0.5, 0.5))).not.toMatchObject({ regionId: "hp" });
  });
});

describe("resolveRegion：粗い位置", () => {
  it("municipality 精度は座標を子に当てず、市区町村に材料を持つエリアの共通の親", () => {
    expect(resolve(at(0.5, 0.5, "municipality"))).toEqual({ ok: true, regionId: "h", by: "municipality" });
    expect(resolve(at(6.5, 1, "municipality"))).toEqual({ ok: true, regionId: "i", by: "municipality" });
    expect(resolve(at(2.5, 1, null))).toEqual({ ok: true, regionId: "i1", by: "municipality" });
  });
  it("市区町村の境界の上は、両方の候補の共通の親（無ければ決まらない）", () => {
    expect(resolve(at(6, 0.5, "municipality"))).toEqual({ ok: false, reason: "ambiguous" }); // M3（i と c）と M4
    expect(resolve(at(2, 0.5, "municipality"))).toEqual({ ok: false, reason: "ambiguous" }); // M1（h）と M2（i1）
  });
  it("座標が無ければ都道府県＋市区町村名、両方無ければ位置なし", () => {
    const named = { lat: null, lng: null, precision: null, prefecture: "架空県", municipality: "四市" };
    expect(candidatePrefectures(named, M)).toEqual(["99"]);
    expect(resolve(named)).toEqual({ ok: true, regionId: "i", by: "municipality" });
    expect(resolve({ ...named, municipality: "無い町" })).toEqual({ ok: false, reason: "outside" });
    expect(resolve({ ...named, prefecture: null })).toEqual({ ok: false, reason: "no_location" });
  });
  it("住所と座標が食い違っても座標を使う", () => {
    expect(resolve({ ...at(0.5, 0.5, "municipality"), prefecture: "架空県", municipality: "四市" })).toMatchObject({ regionId: "h" });
  });
});

describe("decideRegion", () => {
  const exists = (id: string) => id in M.parents;
  const p = M;
  it("明示が決めた結果の子孫なら明示（点のエリアを保つ）", () => {
    expect(decideRegion({ ok: true, regionId: "h", by: "point" }, "hp", exists, p)).toEqual({ ok: true, regionId: "hp", by: "explicit" });
    expect(decideRegion({ ok: true, regionId: "h1", by: "point" }, "hp", exists, p)).toEqual({ ok: true, regionId: "hp", by: "explicit" }); // 点は隣の子に決まっても残す
    expect(decideRegion({ ok: true, regionId: "i1", by: "point" }, "hp", exists, p)).toMatchObject({ regionId: "i1" }); // 別の親なら残さない
  });
  it("明示が別の系統なら決めた結果", () => {
    expect(decideRegion({ ok: true, regionId: "h1", by: "point" }, "i", exists, p)).toMatchObject({ regionId: "h1" });
    expect(decideRegion({ ok: true, regionId: "h1", by: "point" }, "h", exists, p)).toMatchObject({ regionId: "h1" });
  });
  it("決まらなければ実在する明示、無い明示は unknown_region、両方無ければ理由", () => {
    expect(decideRegion({ ok: false, reason: "outside" }, "b", exists, p)).toEqual({ ok: true, regionId: "b", by: "explicit" });
    expect(decideRegion({ ok: false, reason: "outside" }, "nope", exists, p)).toEqual({ ok: false, reason: "unknown_region" });
    expect(decideRegion({ ok: true, regionId: "h1", by: "point" }, "nope", exists, p)).toEqual({ ok: false, reason: "unknown_region" }); // 決まっても書き間違いは通さない
    expect(decideRegion({ ok: false, reason: "outside" }, null, exists, p)).toEqual({ ok: false, reason: "outside" });
  });
  it("commonAncestor：親子は親、別の親どうしは null", () => {
    expect(commonAncestor(["h1", "h"], M.parents)).toBe("h");
    expect(commonAncestor(["h1", "i"], M.parents)).toBeNull();
  });
});

describe("representativeLocation", () => {
  it("体験は meeting の場所、無ければ先頭。先頭に座標が無ければ位置なし", () => {
    const locs = [
      { kind: "activity", lat: 1, lng: 2, geo_precision: "exact" },
      { kind: "meeting", lat: 3, lng: 4, geo_precision: "street" },
    ];
    expect(representativeLocation("experience", {}, { locations: locs })).toMatchObject({ lat: 3, lng: 4, precision: "street" });
    expect(representativeLocation("experience", {}, { locations: [locs[0]] })).toMatchObject({ lat: 1, lng: 2 });
    expect(representativeLocation("experience", {}, { locations: [{ kind: "activity" }, locs[0]] })).toMatchObject({ lat: null });
    expect(representativeLocation("experience", {}, null)).toMatchObject({ lat: null, lng: null });
  });
  it("体験以外はコアの位置と市区町村", () => {
    const core = { lat: 35, lng: 139, geo_precision: "municipality", prefecture: "静岡県", municipality: "伊豆市" };
    expect(representativeLocation("accommodation", core, null)).toEqual({
      lat: 35,
      lng: 139,
      precision: "municipality",
      prefecture: "静岡県",
      municipality: "伊豆市",
    });
  });
});
