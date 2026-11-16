// 地図の段を、エリアの定義と形の範囲から導く（純関数）。手書きの段・寄る範囲はやめる
// 日本 → 地方（エリアのある地方だけ）→ 親エリア（小さい親は自分の地図に寄る）→ 子エリア
import { CHIHO, chihoOf } from "../../src/lib/region/chiho.ts";
import type { BBox, LocalizedName, RegionDef } from "../../src/lib/region/types.ts";

export type Name2 = { ja: string; en: string };

export type MapDef = {
  id: string;
  name: Name2;
  bbox: BBox;
  interval: number; // 簡略化の間隔（m）
  land: "prefectures" | "clip"; // prefectures は都道府県の輪郭（全国用）、clip は表示範囲で切った陸地
  shapes: string[]; // 押すと選べるエリア（子のある親は「子に入らない残り」の形）
  points: string[]; // 押すと選べるエリア（点）
  links: { map: string; shape?: string; chiho?: string }[]; // 押すと寄る先。shape は親エリア全体の形、chiho は地方の形
  wholes: string[]; // 「〇〇全体」として出す親エリア
};

export const JAPAN_BBOX: BBox = [127.5, 24.0, 146.0, 45.7];
const SMALL_PARENT = 0.15; // 表示範囲に対する面積の比がこれより小さい親は、自分の地図に寄る
const NEAR = 0.2; // 地方の範囲をこの割合だけ広げ、かかる親エリアも同じ地図に出す
const INTERVALS = [100, 250, 500, 1000, 2500, 5000];

/** 名前を ja・en の両方にする（無い言語は ja、ja も無ければ最初の言語・id） */
export function name2(name: LocalizedName, id: string): Name2 {
  const first = Object.values(name)[0] ?? id;
  const ja = name.ja ?? first;
  return { ja, en: name.en ?? ja };
}

const union = (bs: BBox[]): BBox => [
  Math.min(...bs.map((b) => b[0])),
  Math.min(...bs.map((b) => b[1])),
  Math.max(...bs.map((b) => b[2])),
  Math.max(...bs.map((b) => b[3])),
];
/** 周りを広げる。幅・高さがほぼ 0（点だけ）でも最低 0.02 度の範囲にする */
export function pad(b: BBox, ratio: number): BBox {
  const w = Math.max(b[2] - b[0], 0.02), h = Math.max(b[3] - b[1], 0.02);
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const hw = (w * (1 + 2 * ratio)) / 2, hh = (h * (1 + 2 * ratio)) / 2;
  return [cx - hw, cy - hh, cx + hw, cy + hh];
}
const overlaps = (a: BBox, b: BBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const area = (b: BBox) => (b[2] - b[0]) * (b[3] - b[1]);

/** 表示範囲の幅に合う簡略化の間隔 */
export function intervalFor(b: BBox): number {
  const widthM = (b[2] - b[0]) * 111_000 * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180);
  return [...INTERVALS].reverse().find((i) => i <= widthM / 80) ?? INTERVALS[0];
}

export type TreeInput = {
  defs: RegionDef[]; // 地図に出せる定義
  bbox: Map<string, BBox>; // エリア全体（自分＋子孫）の範囲。点だけのエリアは点
  cities: Map<string, string[]>; // エリア全体が使う市区町村コード
};

export function deriveMapTree({ defs, bbox, cities }: TreeInput): MapDef[] {
  const roots = defs.filter((d) => d.parentId === null && bbox.has(d.id));
  const childrenOf = (id: string) => defs.filter((d) => d.parentId === id);
  const boxOf = (id: string) => {
    const b = bbox.get(id);
    if (!b) throw new Error(`範囲がありません: ${id}`);
    return b;
  };
  const chihoIds = (id: string) => [...new Set((cities.get(id) ?? []).map((c) => chihoOf(c)?.id).filter((v): v is string => !!v))];

  const maps: MapDef[] = [];
  const regionMaps = new Map<string, MapDef>();
  const regionMap = (r: RegionDef): MapDef => {
    const kids = childrenOf(r.id);
    const b = pad(boxOf(r.id), 0.08);
    return {
      id: r.id,
      name: name2(r.name, r.id),
      bbox: b,
      interval: intervalFor(b),
      land: "clip",
      shapes: kids.filter((k) => k.parts.length > 0).map((k) => k.id),
      points: kids.filter((k) => k.parts.length === 0 && k.point).map((k) => k.id),
      links: [],
      wholes: [r.id],
    };
  };

  const active = CHIHO.filter((c) => roots.some((r) => chihoIds(r.id).includes(c.id)));
  for (const c of active) {
    const own = roots.filter((r) => chihoIds(r.id).includes(c.id));
    const near = pad(union(own.map((r) => boxOf(r.id))), NEAR);
    const inView = roots.filter((r) => overlaps(boxOf(r.id), near));
    const view = pad(union(inView.map((r) => boxOf(r.id))), 0.05);
    const m: MapDef = {
      id: `chiho-${c.id}`,
      name: c.name,
      bbox: view,
      interval: intervalFor(view),
      land: "clip",
      shapes: [],
      points: [],
      links: [],
      wholes: [],
    };
    for (const r of inView) {
      const kids = childrenOf(r.id);
      if (kids.length === 0) {
        if (r.parts.length > 0) m.shapes.push(r.id);
        else if (r.point) m.points.push(r.id);
        continue;
      }
      m.wholes.push(r.id);
      if (area(boxOf(r.id)) / area(view) < SMALL_PARENT) {
        m.links.push({ map: r.id, shape: r.id });
        if (!regionMaps.has(r.id)) regionMaps.set(r.id, regionMap(r));
        continue;
      }
      m.shapes.push(...kids.filter((k) => k.parts.length > 0).map((k) => k.id));
      m.points.push(...kids.filter((k) => k.parts.length === 0 && k.point).map((k) => k.id));
      if (r.parts.length > 0) m.shapes.push(r.id);
    }
    maps.push(m);
  }

  const japan: MapDef = {
    id: "japan",
    name: { ja: "日本", en: "Japan" },
    bbox: JAPAN_BBOX,
    interval: 5000,
    land: "prefectures",
    shapes: [],
    points: [],
    links: active.map((c) => ({ map: `chiho-${c.id}`, chiho: c.id })),
    wholes: [],
  };
  return [japan, ...maps, ...regionMaps.values()];
}
