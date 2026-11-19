import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { areaHighlights, HIGHLIGHT_KINDS, inSeason, type HighlightGroup, type HighlightItem } from "@/lib/area-highlights";
import { AreaStories, nextPos, prevPos } from "./AreaStories";

const item = (id: string): HighlightItem => ({ id, type: "product", name: id, note: "", description: "", color: "#000", photo: null, season: null, offers: [] });
const groups: HighlightGroup[] = [
  { kind: "meisan", items: [item("a"), item("b")] },
  { kind: "benri", items: [item("c")] },
];

describe("エリアの一言のデータ", () => {
  it("全国とデータの無いエリアでは空", () => {
    expect(areaHighlights("all", "ja")).toEqual([]);
    expect(areaHighlights("hakone", "ja")).toEqual([]);
  });
  it("熱海は決まった順で、候補の無い項目は出さない", () => {
    const g = areaHighlights("atami", "ja", 1);
    const order = g.map((x) => HIGHLIGHT_KINDS.indexOf(x.kind));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(g.every((x) => x.items.length > 0)).toBe(true);
  });
  it("扱う店は実店舗が先で、通販が最後", () => {
    for (const g of areaHighlights("atami", "ja", 1))
      for (const it of g.items) {
        const online = it.offers.map((o) => o.online);
        expect(online).toEqual([...online].sort((a, b) => Number(a) - Number(b)));
      }
  });
});

describe("旬", () => {
  it("期間の中だけ旬。年をまたぐ期間も扱う", () => {
    expect(inSeason({ from: 4, to: 6 }, 5)).toBe(true);
    expect(inSeason({ from: 4, to: 6 }, 7)).toBe(false);
    expect(inSeason({ from: 11, to: 2 }, 1)).toBe(true);
    expect(inSeason({ from: 11, to: 2 }, 3)).toBe(false);
    expect(inSeason(null, 1)).toBe(false);
  });
});

describe("ストーリーの送り", () => {
  it("項目の中で次へ、最後なら次の項目、全部見たら閉じる", () => {
    expect(nextPos(groups, { g: 0, i: 0 })).toEqual({ g: 0, i: 1 });
    expect(nextPos(groups, { g: 0, i: 1 })).toEqual({ g: 1, i: 0 });
    expect(nextPos(groups, { g: 1, i: 0 })).toBeNull();
  });
  it("前へは前の項目の最後に戻り、いちばん最初では動かない", () => {
    expect(prevPos(groups, { g: 1, i: 0 })).toEqual({ g: 0, i: 1 });
    expect(prevPos(groups, { g: 0, i: 0 })).toEqual({ g: 0, i: 0 });
  });
});

describe("丸の列", () => {
  it("項目ごとに丸と項目名を出す", () => {
    const h = renderToStaticMarkup(<AreaStories locale="ja" area="atami" areaLabel="熱海" groups={groups} />);
    expect(h).toContain("熱海で知っておきたいこと");
    for (const k of ["名産", "便利"]) expect(h).toContain(`>${k}</span>`);
  });
  it("候補が無ければ何も出さない", () => {
    expect(renderToStaticMarkup(<AreaStories locale="ja" area="all" areaLabel="" groups={[]} />)).toBe("");
  });
});

describe("Google マップ", () => {
  it("店名と住所で検索する URL を作る", async () => {
    const { mapsUrl } = await import("./AreaStories");
    expect(mapsUrl({ shopName: "釜鶴ひもの店", address: "熱海市銀座町10-18" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("釜鶴ひもの店 熱海市銀座町10-18"),
    );
    expect(mapsUrl({ shopName: "店", address: null })).toBe("https://www.google.com/maps/search/?api=1&query=%E5%BA%97");
  });
});

describe("住所", () => {
  it("都道府県と市を省く", async () => {
    const { shortAddress } = await import("@/lib/area-highlights");
    expect(shortAddress("静岡県熱海市銀座町10-18")).toBe("銀座町10-18");
    expect(shortAddress("熱海市田原本町3-14")).toBe("田原本町3-14");
    expect(shortAddress(null)).toBeNull();
  });
});
