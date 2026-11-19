// carousel の段：何をどの順で並べるかを名前@版で差し替える
import { describe, expect, it } from "vitest";
import { destOnly, destTilesOf, loadCarouselStrategy, storiesFirst, storiesLast } from "./carousel";
import type { Tile } from "./types";

const tile = (id: string): Tile => ({ destId: id, label: id, sub: "", photo: null, href: `/ja/d/${id}` });
const rows = [[tile("a"), tile("b")], []];
const atami = { area: "atami", locale: "ja" as const };
const none = { area: "hakone", locale: "ja" as const };

describe("carousel", () => {
  it("stories-first：エリアの一言があるエリアでは全カードの先頭に Stories を置く（タイルが無いカードにも）", () => {
    const out = storiesFirst(rows, atami);
    expect(out[0].map((x) => x.type)).toEqual(["stories", "dest", "dest"]);
    expect(out[1]).toEqual([{ type: "stories", area: "atami" }]);
  });
  it("stories-last：末尾に置く", () => {
    expect(storiesLast(rows, atami)[0].map((x) => x.type)).toEqual(["dest", "dest", "stories"]);
  });
  it("データの無いエリア・全国では Stories を出さない", () => {
    expect(storiesFirst(rows, none)).toEqual(destOnly(rows, none));
    expect(storiesFirst(rows, { area: "all", locale: "ja" })).toEqual(destOnly(rows, none));
  });
  it("dest-only：行き先のタイルだけ。destTilesOf で元のタイルに戻る", () => {
    const out = destOnly(rows, atami);
    expect(out.map(destTilesOf)).toEqual(rows);
  });
  it("名前と版を id にする。知らない名前・未設定は stories-first", () => {
    expect(loadCarouselStrategy("stories-last").id).toBe("carousel=stories-last@1");
    expect(loadCarouselStrategy("nope").id).toBe("carousel=stories-first@1");
    expect(loadCarouselStrategy("constructor").id).toBe("carousel=stories-first@1");
  });
});
