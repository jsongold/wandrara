// 地図に出すラベルを決める（純関数）。どの縮尺で出すかは生成ファイルの labelK に入っている（area-label-zoom.ts）。
// ここでは今の k と比べるだけ。選択中のラベルは必ず出し、それとぶつかるラベルだけ隠す
import { labelSize, showsAt } from "./area-label-zoom.ts";
import type { LabelK } from "./area-map.ts";

export type LabelItem = { id: string; at: [number, number]; labelK?: LabelK; font: number };
export type PlacedLabel = { id: string; x: number; y: number; font: number };
export type LabelView = {
  k: number; // 地図の単位 / 画面 px
  locale: string;
  selected: string | null;
  toScreen: (x: number, y: number) => [number, number];
  textOf: (id: string) => string;
  width: number; // 枠の大きさ（外のラベルは描かない）
  height: number;
};

const OUTSIDE = 120; // 枠の外でも、これ px までは描く（端で切れて滑り出る）

export function visibleLabels(items: LabelItem[], v: LabelView): PlacedLabel[] {
  const shown = items
    .filter((i) => i.id === v.selected || showsAt(i.labelK?.[v.locale], v.k))
    .map((i) => {
      const [x, y] = v.toScreen(i.at[0], i.at[1]);
      return { id: i.id, x, y, font: i.font };
    })
    .filter((l) => l.x > -OUTSIDE && l.x < v.width + OUTSIDE && l.y > -OUTSIDE && l.y < v.height + OUTSIDE);
  const sel = shown.find((l) => l.id === v.selected);
  if (!sel) return shown;
  const [sw, sh] = labelSize(v.textOf(sel.id), sel.font);
  return shown.filter((l) => {
    if (l === sel) return true;
    const [w, h] = labelSize(v.textOf(l.id), l.font);
    return Math.abs(l.x - sel.x) >= (w + sw) / 2 + 4 || Math.abs(l.y - sel.y) >= (h + sh) / 2 + 2;
  });
}
