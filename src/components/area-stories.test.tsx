import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { areaHighlights } from "@/lib/area-highlights";
import { AreaStories, nextPos, prevPos } from "./AreaStories";

describe("エリアの一言のデータ", () => {
  it("全国とデータの無いエリアでは空", () => {
    expect(areaHighlights("all", "ja")).toEqual([]);
    expect(areaHighlights("hakone", "ja")).toEqual([]);
  });
  it("熱海は名産・特産・旬・便利・人気の順で、各項目に候補が複数ある", () => {
    const g = areaHighlights("atami", "ja");
    expect(g.map((x) => x.kind)).toEqual(["meisan", "tokusan", "shun", "benri", "ninki"]);
    expect(g.every((x) => x.items.length >= 2)).toBe(true);
  });
  it("借りるものには PR が付く", () => {
    const benri = areaHighlights("atami", "en").find((x) => x.kind === "benri")!;
    expect(benri.items.every((it) => it.action === "rent" && it.pr)).toBe(true);
  });
});

describe("ストーリーの送り", () => {
  const g = areaHighlights("atami", "ja");
  it("項目の中で次へ、最後なら次の項目、全部見たら閉じる", () => {
    expect(nextPos(g, { g: 0, i: 0 })).toEqual({ g: 0, i: 1 });
    expect(nextPos(g, { g: 0, i: g[0].items.length - 1 })).toEqual({ g: 1, i: 0 });
    expect(nextPos(g, { g: g.length - 1, i: g[g.length - 1].items.length - 1 })).toBeNull();
  });
  it("前へは前の項目の最後に戻り、いちばん最初では動かない", () => {
    expect(prevPos(g, { g: 1, i: 0 })).toEqual({ g: 0, i: g[0].items.length - 1 });
    expect(prevPos(g, { g: 0, i: 0 })).toEqual({ g: 0, i: 0 });
  });
});

describe("丸の列", () => {
  it("項目ごとに丸と項目名を出す", () => {
    const h = renderToStaticMarkup(<AreaStories locale="ja" area="atami" areaLabel="熱海" groups={areaHighlights("atami", "ja")} />);
    expect(h).toContain("熱海で知っておきたいこと");
    for (const k of ["名産", "特産", "旬", "便利", "人気"]) expect(h).toContain(`>${k}</span>`);
  });
  it("候補が無ければ何も出さない", () => {
    expect(renderToStaticMarkup(<AreaStories locale="ja" area="all" areaLabel="" groups={[]} />)).toBe("");
  });
});
