import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { areaHighlights, HIGHLIGHT_KINDS, inSeason, type HighlightGroup, type HighlightItem } from "@/lib/area-highlights";
import { messages } from "@/lib/i18n/messages";
import { NearbySuggestions } from "../NearbySuggestions";
import { nextPos, prevPos } from "./story-nav";

const item = (id: string): HighlightItem => ({ id, type: "product", name: id, note: "", description: "", color: "#000", photo: null, season: null, offers: [] });
const groups: HighlightGroup[] = [
  { kind: "meisan", items: [item("a"), item("b")] },
  { kind: "benri", items: [item("c")] },
];

describe("エリアの一言のデータ", () => {
  it("全国とデータの無いエリアでは空", () => {
    expect(areaHighlights("all", "ja")).toEqual([]);
    expect(areaHighlights("hakone", "ja")).toEqual([]);
    expect(areaHighlights("constructor", "ja")).toEqual([]);
    expect(areaHighlights("__proto__", "ja")).toEqual([]);
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

describe("カルーセルのエリアの一言の 1 枚", () => {
  const stories = () => {};
  const dest = { type: "dest" as const, tile: { destId: "d1", label: "宿", sub: "", photo: null, href: "/ja/d/d1" } };
  it("エリア名と件数、項目名を出し、押した記録のための印を付ける", () => {
    const h = renderToStaticMarkup(<NearbySuggestions title="近く" items={[{ type: "stories", area: "atami", label: "熱海" }, dest]} stories={stories} />);
    expect(h).toContain("熱海の一言");
    expect(h).toContain('data-stories-area="atami"');
    expect(h).toContain('data-tile-position="0"');
    expect(h).toContain('data-tile-position="1"');
    for (const g of areaHighlights("atami", "ja").slice(0, 4)) expect(h).toContain(`>${messages("ja").highlights.kind[g.kind]}</span>`);
  });
  it("データの無いエリアでは 1 枚を出さない", () => {
    const h = renderToStaticMarkup(<NearbySuggestions title="近く" items={[{ type: "stories", area: "hakone", label: "箱根" }, dest]} stories={stories} />);
    expect(h).not.toContain("data-stories-area");
    expect(h).toContain('data-tile-dest-id="d1"');
  });
});

describe("Google マップ", () => {
  it("店名と省く前の住所で検索する URL を作る", async () => {
    const { mapsUrl } = await import("./maps-url");
    expect(mapsUrl({ shopName: "釜鶴ひもの店", fullAddress: "静岡県熱海市銀座町10-18" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("釜鶴ひもの店 静岡県熱海市銀座町10-18"),
    );
    expect(mapsUrl({ shopName: "店", fullAddress: null })).toBe("https://www.google.com/maps/search/?api=1&query=%E5%BA%97");
  });
  it("熱海のデータでは、地図の検索に省く前の住所（熱海市を含む）を使う", () => {
    const offers = areaHighlights("atami", "ja", 11).flatMap((g) => g.items.flatMap((i) => i.offers)).filter((o) => o.fullAddress);
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) expect(o.fullAddress).not.toBe(o.address);
  });
});

describe("スワイプで閉じる（詳細ページと同じ決まり）", () => {
  it("120px より引いたら閉じる。短くても素早く払ったら閉じる。止めてから離したら払ったと見なさない", async () => {
    const { swipeDecision } = await import("../use-swipe-down");
    expect(swipeDecision(130, 0, 500)).toBe(true);
    expect(swipeDecision(50, 0.8, 20)).toBe(true);
    expect(swipeDecision(50, 0.8, 300)).toBe(false);
    expect(swipeDecision(20, 2, 10)).toBe(false);
    expect(swipeDecision(100, 0.2, 10)).toBe(false);
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

describe("時間帯と言語", () => {
  it("旬の月は日本の時間で決める（UTC で月末の夜は日本ではもう翌月）", async () => {
    const { tokyoMonth } = await import("@/lib/area-highlights");
    expect(tokyoMonth(new Date("2027-03-31T16:00:00Z"))).toBe(4);
    expect(tokyoMonth(new Date("2027-03-31T14:00:00Z"))).toBe(3);
  });
  it("英語では営業時間・定休・価格のメモも英語", () => {
    const offers = areaHighlights("atami", "en", 11).flatMap((g) => g.items.flatMap((i) => i.offers));
    const ja = /[぀-ヿ]/;
    for (const o of offers) for (const v of [o.hours, o.closed, o.priceNote]) if (v) expect(v).not.toMatch(ja);
  });
});

describe("写真のライセンス", () => {
  it("CC のライセンス名からページの URL を作る", async () => {
    const { licenseUrl } = await import("@/lib/area-highlights");
    expect(licenseUrl("CC BY-SA 4.0")).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
    expect(licenseUrl("CC BY 4.0")).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(licenseUrl("CC0")).toBe("https://creativecommons.org/publicdomain/zero/1.0/");
    expect(licenseUrl("Public domain")).toBeNull();
  });
});
