import type { Box } from "./area-map.ts";
// 地図の表示範囲（SVG の viewBox）を動かす・寄せる計算（純関数）。画面の px と viewBox の単位の換算は呼ぶ側が渡す
export type View = { x: number; y: number; w: number; h: number };

export const MAX_ZOOM = 200; // 全体の幅の 1/200 まで寄れる（全国の地図で 10km 級まで）

export function parseView(s: string): View {
  const [x, y, w, h] = s.split(" ").map(Number);
  return { x, y, w, h };
}

export const viewString = (v: View) => `${v.x} ${v.y} ${v.w} ${v.h}`;

/** 寄りすぎ・引きすぎを止め、中心が地図全体の外に出ないようにする */
export function clampView(v: View, full: View): View {
  const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, v.w));
  const h = (v.h / v.w) * w;
  const cx = Math.min(full.x + full.w, Math.max(full.x, v.x + v.w / 2));
  const cy = Math.min(full.y + full.h, Math.max(full.y, v.y + v.h / 2));
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** 表示を (dx, dy) だけ動かす（viewBox の単位。指を右へ動かすと地図も右へ動く） */
export function panBy(v: View, dx: number, dy: number, full: View): View {
  return clampView({ ...v, x: v.x - dx, y: v.y - dy }, full);
}

/** 点 (px, py)（viewBox の単位）を動かさずに factor 倍に寄せる（factor > 1 で寄る） */
export function zoomAt(v: View, px: number, py: number, factor: number, full: View): View {
  const w = v.w / factor;
  const h = v.h / factor;
  return clampView({ x: px - ((px - v.x) / v.w) * w, y: py - ((py - v.y) / v.h) * h, w, h }, full);
}

/** preserveAspectRatio="xMidYMid meet" の SVG で、要素の中の px を viewBox の座標にする */
export function toView(v: View, box: { w: number; h: number }, px: number, py: number): { x: number; y: number; unit: number } {
  const unit = Math.max(v.w / box.w, v.h / box.h); // 1px あたりの viewBox の単位
  const ox = (box.w - v.w / unit) / 2;
  const oy = (box.h - v.h / unit) / 2;
  return { x: v.x + (px - ox) * unit, y: v.y + (py - oy) * unit, unit };
}

/** toView の逆。viewBox の座標を、要素の中の px にする */
export function toScreen(v: View, box: { w: number; h: number }, x: number, y: number): [number, number] {
  const unit = Math.max(v.w / box.w, v.h / box.h);
  const ox = (box.w - v.w / unit) / 2;
  const oy = (box.h - v.h / unit) / 2;
  return [ox + (x - v.x) / unit, oy + (y - v.y) / unit];
}

/** target の中心に寄せ、pad 倍の余白を付けた表示範囲。枠と同じ縦横比で、幅は maxW まで（小さいエリアは maxW まで寄る） */
export function fitView(target: Box, box: { w: number; h: number }, maxW: number, pad = 1.25): View {
  const [tx, ty, tw, th] = target;
  const aspect = box.w / box.h;
  const w = Math.min(maxW, Math.max(tw * pad, th * pad * aspect));
  const h = w / aspect;
  return { x: tx + tw / 2 - w / 2, y: ty + th / 2 - h / 2, w, h };
}
