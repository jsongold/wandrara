// 今の表示範囲から、何を出すかを決める（純関数）
import { CHILD_ZOOM, type Box } from "./area-map.ts";
import type { View } from "./pan-zoom.ts";

/** 子を出す寄り方か（開いたときの幅の 1/CHILD_ZOOM 以下） */
export function showChildren(view: View, start: View): boolean {
  return view.w <= start.w / CHILD_ZOOM;
}

/** 表示範囲にかかる親の id（box が view と重なるもの） */
export function visibleParents(parents: { id: string; box: Box }[], view: View): string[] {
  return parents
    .filter(({ box: [x, y, w, h] }) => x < view.x + view.w && x + w > view.x && y < view.y + view.h && y + h > view.y)
    .map((p) => p.id);
}
