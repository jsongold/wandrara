import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apartScale, labelScales, labelSize, shortName, showsAt, toMaxUnit, type ZoomLabel } from "./area-label-zoom.ts";
import type { AreaMapBase, AreaMapChildren } from "./area-map.ts";

const L = (id: string, x: number, y: number, w = 40, box: ZoomLabel["box"] = null): ZoomLabel => ({ id, at: [x, y], box, size: [w, 16] });

describe("area-label-zoom", () => {
  it("labelSize：全角は 1 文字 = font、半角は 0.6", () => {
    expect(labelSize("箱根", 10)).toEqual([24, 14]);
    expect(labelSize("Hakone", 10)).toEqual([40, 14]);
  });
  it("shortName：政令市の区だけ短くする", () => {
    expect(shortName("横浜市中区")).toBe("中区");
    expect(shortName("箱根町")).toBe("箱根町");
  });
  it("apartScale：横か縦のどちらかで離れる縮尺", () => {
    // 横に 10 離れている：(40+40)/2+4 = 44px 要るので 4.4 倍
    expect(apartScale(L("a", 0, 0), L("b", 10, 0))).toBeCloseTo(4.4);
    // 縦に 10 離れている：(16+16)/2+2 = 18px → 1.8 倍（横よりこちらが先に離れる）
    expect(apartScale(L("a", 0, 0), L("b", 10, 10))).toBeCloseTo(1.8);
  });
  it("labelScales：上のラベルとぶつかる間は出さない。上が出ない縮尺のぶつかりは数えない", () => {
    const s = labelScales([L("a", 0, 0), L("b", 10, 0), L("c", 20, 0)]);
    expect(s.get("a")).toBe(0);
    expect(s.get("b")).toBeCloseTo(4.4);
    expect(s.get("c")).toBeCloseTo(2.2); // a とは 20 離れている。b とは b が出る 4.4 以上ではぶつからない
  });
  it("labelScales：エリアが小さいうちは出さない", () => {
    // 幅 10 のエリアに幅 40 のラベル：40*0.6/10 = 2.4 倍、高さ 10：24/10 = 2.4 倍
    expect(labelScales([L("a", 0, 0, 40, [0, 0, 10, 10])]).get("a")).toBeCloseTo(2.4);
  });
  it("toMaxUnit・showsAt：縮尺を k にして比べる", () => {
    expect(toMaxUnit(0)).toBeNull();
    expect(toMaxUnit(Infinity)).toBe(0);
    expect(toMaxUnit(3)).toBeLessThanOrEqual(1 / 3);
    expect(showsAt(null, 100)).toBe(true);
    expect(showsAt(0.5, 0.4)).toBe(true);
    expect(showsAt(0.5, 0.6)).toBe(false);
    expect(showsAt(undefined, 0.1)).toBe(false);
  });
});

// 本物の地図の形で：どの縮尺でも、出しているラベルどうしが重ならない
const dir = join(process.cwd(), "src/generated/area-map");
const base = JSON.parse(readFileSync(join(dir, "base.json"), "utf8")) as AreaMapBase;
const children = readdirSync(join(dir, "children")).map((f) => JSON.parse(readFileSync(join(dir, "children", f), "utf8")) as AreaMapChildren);
const fake = (id: string, font: number) => labelSize("あ".repeat(2 + ([...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 5)), font);

describe("本物の地図の形", () => {
  const layers: [string, ZoomLabel[]][] = [
    ["親", [...base.parents].sort((a, b) => b.size - a.size).map((p) => ({ id: p.id, at: p.label, box: p.box, size: fake(p.id, 13) }))],
    ["子", children.flatMap((c) => c.shapes.filter((s) => s.id !== c.parent)).sort((a, b) => b.size - a.size).map((s) => ({ id: s.id, at: s.label, box: s.box, size: fake(s.id, 11) }))],
  ];
  // 2 つとも出ている縮尺（両方の出す縮尺の大きいほう以上）では、もう離れている
  it.each(layers)("%s：どの縮尺でも重ならない", (_, labels) => {
    const scales = labelScales(labels);
    const bad: string[] = [];
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const both = Math.max(scales.get(labels[i].id)!, scales.get(labels[j].id)!);
        if (Number.isFinite(both) && apartScale(labels[i], labels[j]) > both + 1e-9) bad.push(`${labels[i].id}・${labels[j].id}`);
      }
    expect(bad).toEqual([]);
  });
  it("生成ファイルの全ラベルに ja・en の labelK がある", () => {
    const missing = [
      ...base.parents.filter((p) => !p.labelK || !("ja" in p.labelK) || !("en" in p.labelK)).map((p) => p.id),
      ...children.flatMap((c) => [...c.shapes.filter((s) => s.id !== c.parent), ...c.points]).filter((s) => !s.labelK || !("ja" in s.labelK) || !("en" in s.labelK)).map((s) => s.id),
    ];
    expect(missing).toEqual([]);
  });
});
