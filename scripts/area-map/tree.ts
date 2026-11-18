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
  start?: BBox; // 開いたときに見せる範囲（無ければ全体）
};

export const JAPAN_BBOX: BBox = [127.5, 24.0, 146.0, 45.7];
// 日本の地図は、開いたとき東京を中心に寄せて見せる（動かせば全国が見える）
export const JAPAN_START: BBox = [136.9, 33.4, 141.9, 37.9];
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

/** 表示範囲の幅に合う簡略化の間隔 */
export function intervalFor(b: BBox): number {
  const widthM = (b[2] - b[0]) * 111_000 * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180);
  return [...INTERVALS].reverse().find((i) => i <= widthM / 80) ?? INTERVALS[0];
}

export type TreeInput = {
  defs: RegionDef[]; // 地図に出せる定義
  bbox: Map<string, BBox>; // エリア全体（自分＋子孫）の範囲。点だけのエリアは点
  cities: Map<string, string[]>; // エリア全体が使う市区町村コード
  chihoView?: Map<string, BBox>; // 地方の本土の範囲（離島を除く）。無ければその地方のエリアの範囲の和
};

export function deriveMapTree({ defs, bbox, cities, chihoView }: TreeInput): MapDef[] {
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
      // 子と、親自身の材料があれば「子に入らない残り」（伊豆など）
      shapes: [...kids.filter((k) => k.parts.length > 0).map((k) => k.id), ...(r.parts.length > 0 ? [r.id] : [])],
      points: kids.filter((k) => k.parts.length === 0 && k.point).map((k) => k.id),
      links: [],
      wholes: [r.id],
    };
  };

  // 地方の地図：範囲は地方の本土（離島を除いた陸地）。中心がその範囲に入る親エリアを出す。
  // 子のある親は自分の地図へ寄るリンクにする（全国では親が多いので、子をその場には並べない）
  const active = CHIHO.filter((c) => roots.some((r) => chihoIds(r.id).includes(c.id)));
  for (const c of active) {
    const own = roots.filter((r) => chihoIds(r.id).includes(c.id));
    const view = pad(chihoView?.get(c.id) ?? union(own.map((r) => boxOf(r.id))), 0.03);
    const centerIn = (b: BBox) => {
      const x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2;
      return x >= view[0] && x <= view[2] && y >= view[1] && y <= view[3];
    };
    const inView = roots.filter((r) => centerIn(boxOf(r.id)));
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
      m.links.push({ map: r.id, shape: r.id });
      if (!regionMaps.has(r.id)) regionMaps.set(r.id, regionMap(r));
    }
    maps.push(m);
  }

  const japan: MapDef = {
    id: "japan",
    name: { ja: "日本", en: "Japan" },
    bbox: JAPAN_BBOX,
    start: JAPAN_START,
    interval: 2500,
    land: "prefectures",
    shapes: [],
    points: [],
    links: active.map((c) => ({ map: `chiho-${c.id}`, chiho: c.id })),
    wholes: [],
  };
  return [japan, ...maps, ...regionMaps.values()];
}
