// carousel の段：何をどの順で並べるかを名前@版で差し替える。Stories はカードの地区（無ければ親）で決める
import { describe, expect, it } from "vitest";
import { destOnly, destTilesOf, loadCarouselStrategy, storiesFirst, storiesFirstOnce, storiesLast, type CarouselRow } from "./carousel";
import type { Tile } from "./types";

const tile = (id: string): Tile => ({ destId: id, label: id, sub: "", photo: null, href: `/ja/d/${id}` });
const atami = [{ id: "atami", name: "熱海" }, { id: "izu", name: "伊豆" }];
const higashi = [{ id: "higashi-izu", name: "東伊豆" }, { id: "izu", name: "伊豆" }];
const row = (regions: CarouselRow["regions"], ...ids: string[]): CarouselRow => ({ tiles: ids.map(tile), regions });
const ctx = { locale: "ja" as const, prevArea: null };
const kinds = (out: ReturnType<typeof destOnly>) => out.map((r) => r.map((x) => (x.type === "dest" ? x.tile.destId : `S:${x.area}`)));

describe("carousel", () => {
  // 伊豆で絞り込むと熱海と東伊豆が混ざる
  const mixed = [row(atami, "a"), row(atami, "b"), row(higashi, "c"), row(atami), row([], "d")];

  it("stories-first：カードの地区にエリアの一言があれば先頭に置く。データの無い地区・地区の無いカードには出さない", () => {
    expect(kinds(storiesFirst(mixed, ctx))).toEqual([["S:atami", "a"], ["S:atami", "b"], ["c"], ["S:atami"], ["d"]]);
    expect(storiesFirst(mixed, ctx)[0][0]).toEqual({ type: "stories", area: "atami", label: "熱海" });
  });
  it("地区に無ければ親で引く", () => {
    expect(kinds(storiesFirst([row([{ id: "x", name: "X" }, { id: "atami", name: "熱海" }])], ctx))).toEqual([["S:atami"]]);
  });
  it("stories-last：末尾に置く", () => {
    expect(kinds(storiesLast([row(atami, "a")], ctx))).toEqual([["a", "S:atami"]]);
  });
  it("stories-first-once：前のカードと同じエリアなら出さない（前のページの最後のカード prevArea も見る）", () => {
    expect(kinds(storiesFirstOnce(mixed, ctx))).toEqual([["S:atami", "a"], ["b"], ["c"], ["S:atami"], ["d"]]);
    expect(kinds(storiesFirstOnce([row(atami, "a")], { ...ctx, prevArea: "atami" }))).toEqual([["a"]]);
  });
  it("dest-only：行き先のタイルだけ。destTilesOf で元のタイルに戻る", () => {
    expect(destOnly(mixed, ctx).map(destTilesOf)).toEqual(mixed.map((r) => r.tiles));
  });
  it("名前と版を id にする。知らない名前・未設定は stories-first-once", () => {
    expect(loadCarouselStrategy("stories-last").id).toBe("carousel=stories-last@2");
    expect(loadCarouselStrategy("nope").id).toBe("carousel=stories-first-once@1");
    expect(loadCarouselStrategy("constructor").id).toBe("carousel=stories-first-once@1");
  });
});
