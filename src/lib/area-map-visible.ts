// 今の表示範囲から、何を出すかを決める（純関数）
import { CHILD_ZOOM, type Box } from "./area-map.ts";
import type { View } from "./pan-zoom.ts";

const CHILD_KEEP = 1.15; // 子を出している間は、ここまで引いても子のまま（境目で親 ⇄ 子を往復しない）

/** 子を出す寄り方か（開いたときの幅の 1/CHILD_ZOOM 以下。was = 今子を出しているか） */
export function showChildren(view: View, start: View, was = false): boolean {
  return view.w <= (start.w / CHILD_ZOOM) * (was ? CHILD_KEEP : 1);
}

/** 表示範囲にかかる親の id（box が view と重なるもの） */
export function visibleParents(parents: { id: string; box: Box }[], view: View): string[] {
  return parents
    .filter(({ box: [x, y, w, h] }) => x < view.x + view.w && x + w > view.x && y < view.y + view.h && y + h > view.y)
    .map((p) => p.id);
}
