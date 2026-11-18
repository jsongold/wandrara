import { describe, expect, it } from "vitest";
import { layoutLabels, type LabelCandidate } from "./area-labels.ts";

const frame = { width: 400, height: 600, top: 50, bottom: 50, selected: null as string | null };
const c = (id: string, x: number, y: number, rank = 1, over: Partial<LabelCandidate> = {}): LabelCandidate => ({
  id, text: "熱海", at: [x, y], size: [100, 100], font: 12, rank, ...over,
});
const ids = (l: ReturnType<typeof layoutLabels>) => l.map((p) => p.id);

describe("layoutLabels", () => {
  it("rank の大きい順に置き、重なるものは落とす", () => {
    expect(ids(layoutLabels([c("a", 100, 100, 1), c("b", 110, 105, 5), c("c", 300, 300, 3)], frame))).toEqual(["b", "c"]);
  });
  it("選択中は rank に関わらず先に置く・小さくても置く", () => {
    const l = layoutLabels([c("a", 100, 100, 9), c("b", 105, 100, 1, { size: [2, 2] })], { ...frame, selected: "b" });
    expect(ids(l)).toEqual(["b"]);
  });
  it("エリアが小さすぎるものは置かない", () => {
    expect(ids(layoutLabels([c("a", 100, 100, 1, { size: [5, 5] })], frame))).toEqual([]);
  });
  it("枠・上下の余白からはみ出すものは置かない（選択中も）", () => {
    const l = layoutLabels([c("a", 5, 100), c("b", 100, 20), c("c", 100, 580), c("d", 200, 300)], { ...frame, selected: "a" });
    expect(ids(l)).toEqual(["d"]);
  });
});
