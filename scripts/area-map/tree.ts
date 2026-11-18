// 1 枚の地図に出すものを、エリアの定義から決める（純関数）
// 引いているときは親エリア（子も含めた全体の形）、寄せたら親ごとに子エリアと点
import type { BBox, LocalizedName, RegionDef } from "../../src/lib/region/types.ts";

export type Name2 = { ja: string; en: string };

export type SheetPlan = {
  parents: string[]; // 親エリア（形のあるもの）
  children: { parent: string; shapes: string[]; points: string[] }[]; // 親ごとの子。shapes には親自身の材料の残り（id = 親）も入る
};

export const JAPAN_BBOX: BBox = [122.9, 24.0, 146.0, 45.7]; // 与那国から根室・宗谷まで
// 開いたときに見せる範囲：箱根・伊豆・富士五湖・横浜・秩父が入る、東京の周り（動かせば全国が見える）
export const JAPAN_START: BBox = [138.4, 34.5, 140.2, 36.3];
const INTERVALS = [100, 250, 500, 1000, 2500, 5000];

/** 名前を ja・en の両方にする（無い言語は ja、ja も無ければ最初の言語・id） */
export function name2(name: LocalizedName, id: string): Name2 {
  const first = Object.values(name)[0] ?? id;
  const ja = name.ja ?? first;
  return { ja, en: name.en ?? ja };
}

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

/** hasShape：そのエリア全体（自分＋子）の形があるか */
export function planSheet(defs: RegionDef[], hasShape: (id: string) => boolean): SheetPlan {
  const roots = defs.filter((d) => d.parentId === null && hasShape(d.id));
  return {
    parents: roots.map((r) => r.id),
    children: roots.flatMap((r) => {
      const kids = defs.filter((d) => d.parentId === r.id);
      if (kids.length === 0) return [];
      return [{
        parent: r.id,
        shapes: [...kids.filter((k) => k.parts.length > 0).map((k) => k.id), ...(r.parts.length > 0 ? [r.id] : [])],
        points: kids.filter((k) => k.parts.length === 0 && k.point).map((k) => k.id),
      }];
    }),
  };
}
