// story-nav：ストーリーの送り。g は項目（名産など）、i はその中の候補
import type { HighlightGroup } from "@/lib/area-highlights";

export type StoryPos = { g: number; i: number };

// 次の候補。項目の最後なら次の項目の最初、全部見たら null（閉じる）
export function nextPos(groups: HighlightGroup[], p: StoryPos): StoryPos | null {
  if (p.i + 1 < groups[p.g].items.length) return { g: p.g, i: p.i + 1 };
  if (p.g + 1 < groups.length) return { g: p.g + 1, i: 0 };
  return null;
}

// 前の候補。項目の最初なら前の項目の最後、いちばん最初ならそのまま
export function prevPos(groups: HighlightGroup[], p: StoryPos): StoryPos {
  if (p.i > 0) return { g: p.g, i: p.i - 1 };
  if (p.g > 0) return { g: p.g - 1, i: groups[p.g - 1].items.length - 1 };
  return p;
}
