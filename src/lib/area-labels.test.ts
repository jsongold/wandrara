import { describe, expect, it } from "vitest";
import { visibleLabels, type LabelItem } from "./area-labels.ts";

const item = (id: string, x: number, k: number | null, font = 12): LabelItem => ({ id, at: [x, 100], labelK: { ja: k }, font });
const view = { k: 1, locale: "ja", selected: null as string | null, toScreen: (x: number, y: number) => [x, y] as [number, number], textOf: () => "熱海", width: 400, height: 600 };
const ids = (l: { id: string }[]) => l.map((p) => p.id);

describe("visibleLabels", () => {
  it("今の k が labelK 以下のものだけ出す（null はいつでも・無ければ出さない）", () => {
    const items = [item("a", 100, 2), item("b", 150, 0.5), item("c", 200, null), { id: "d", at: [250, 100] as [number, number], font: 12 }];
    expect(ids(visibleLabels(items, view))).toEqual(["a", "c"]);
  });
  it("選択中は必ず出し、それとぶつかるものは隠す", () => {
    const items = [item("a", 100, null), item("b", 110, 0), item("c", 300, null)];
    expect(ids(visibleLabels(items, { ...view, selected: "b" }))).toEqual(["b", "c"]);
  });
  it("枠から遠く外れたものは描かない（少しの外は描く）", () => {
    expect(ids(visibleLabels([item("a", -50, null), item("b", -500, null)], view))).toEqual(["a"]);
  });
});
