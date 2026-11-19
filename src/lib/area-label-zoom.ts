// エリアの地図のラベルを「どこまで寄せたら出すか」で決める（純関数。生成スクリプトと画面の両方で使う）
// ラベルは画面の px で同じ大きさ、地図だけが拡大縮小する。2 つのラベルがぶつかるかは縮尺だけで決まるので、
// 優先度の高い順に「ぶつからなくなる縮尺」を求めておけば、画面では今の縮尺と比べるだけで済む。
// 寄せる間は出るだけ、引く間は消えるだけ、動かすだけなら変わらない（ちらつかない）。
import type { Box } from "./area-map.ts";

const GAP: [number, number] = [4, 2]; // ラベルどうしの横・縦の間（px）
const MIN_W = 0.6; // エリアの幅がラベルの幅のこれ倍未満、かつ
const MIN_H = 24; // 高さがこれ px 未満なら、小さすぎて出さない

/** 政令市の区は「横浜市中区」→「中区」と短くする（地図では親が横浜と分かる） */
export const shortName = (s: string) => s.replace(/^[^・]+市(.+区)$/, "$1");

/** ラベルの画面上の大きさ [幅, 高さ] px（全角は 1 文字 = font、半角は 0.6 文字分） */
export function labelSize(text: string, font: number): [number, number] {
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 0xff ? font : font * 0.6;
  return [Math.ceil(w) + 4, font + 4];
}

/** ラベル 1 つ。at = 地図の座標、box = エリアの矩形（点なら null）、size = 画面の px */
export type ZoomLabel = { id: string; at: [number, number]; box: Box | null; size: [number, number] };

/** a と b がぶつからなくなる縮尺（画面 px / 地図の単位）。これ未満の縮尺ではぶつかる */
export function apartScale(a: ZoomLabel, b: ZoomLabel): number {
  const dx = Math.abs(a.at[0] - b.at[0]);
  const dy = Math.abs(a.at[1] - b.at[1]);
  const sx = dx > 0 ? ((a.size[0] + b.size[0]) / 2 + GAP[0]) / dx : Infinity;
  const sy = dy > 0 ? ((a.size[1] + b.size[1]) / 2 + GAP[1]) / dy : Infinity;
  return Math.min(sx, sy); // 横か縦のどちらかで離れれば、ぶつからない
}

/** 小さすぎなくなる縮尺（点は 0） */
function bigEnoughScale(l: ZoomLabel): number {
  if (!l.box) return 0;
  const [, , w, h] = l.box;
  return Math.min(w > 0 ? (l.size[0] * MIN_W) / w : Infinity, h > 0 ? MIN_H / h : Infinity);
}

/**
 * 優先度の高い順に並んだラベルから、それぞれ「出す最小の縮尺」を返す（Infinity = 出さない）。
 * 縮尺がこれ以上なら出す。上のラベルが出ている縮尺でぶつかるなら、ぶつからなくなるまで出さない。
 */
export function labelScales(ordered: ZoomLabel[]): Map<string, number> {
  const out = new Map<string, number>();
  const done: { l: ZoomLabel; s: number }[] = [];
  for (const l of ordered) {
    let s = bigEnoughScale(l);
    for (const p of done) {
      if (p.s === Infinity) continue;
      const apart = apartScale(l, p.l);
      if (apart > p.s) s = Math.max(s, apart); // p が出ている縮尺 [p.s, apart) でぶつかる
    }
    out.set(l.id, s);
    done.push({ l, s });
  }
  return out;
}

/** 縮尺を、生成ファイルに書く「出す最大の k（地図の単位 / 画面 px）」にする。null = いつでも出す、0 = 出さない */
export function toMaxUnit(scale: number): number | null {
  if (scale <= 0) return null;
  if (!Number.isFinite(scale)) return 0;
  const v = 1 / scale;
  const e = 10 ** (Math.floor(Math.log10(v)) - 3);
  return Number((Math.floor(v / e) * e).toPrecision(4)); // 切り捨て（ぶつかる側へ丸めない）
}

/** 今の k で出すか（maxUnit は生成ファイルの値。無ければ出さない） */
export function showsAt(maxUnit: number | null | undefined, k: number): boolean {
  if (maxUnit === undefined) return false;
  return maxUnit === null || k <= maxUnit;
}
