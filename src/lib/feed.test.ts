import { describe, expect, it } from "vitest";
import { parseDiscoverQuery, serializeDiscoverQuery, DEFAULT_QUERY } from "./discover-query";
import { buildFeed, dedupeRelatedTiles, resolveLocalizedText, type Catalog } from "./feed";
import { loadFeedStrategies } from "./feed-config";
import type { DiscoverQuery, Spot, Tile } from "./types";

const photo = { url: null, license: null, credit: null, isDemo: true, placeholderSky: "#aaa", placeholderLand: "#333" };
const spot = (id: string, kind: Spot["kind"], areaId: string, categoryIds: string[], rank: number): Spot => ({
  id, kind, areaId, categoryIds, editorialRank: rank, isDemo: true, createdAt: `2026-11-${String(rank).padStart(2, "0")}T00:00:00Z`,
  name: { ja: id }, summary: null, photos: [photo],
});

const catalog: Catalog = {
  areas: [
    { id: "hakone", parentId: null, name: { ja: "箱根" }, sort: 1 },
    { id: "ashinoko", parentId: "hakone", name: { ja: "芦ノ湖" }, sort: 1 },
    { id: "gora", parentId: "hakone", name: { ja: "強羅" }, sort: 2 },
    { id: "izu", parentId: null, name: { ja: "伊豆" }, sort: 2 },
    { id: "shimoda", parentId: "izu", name: { ja: "下田" }, sort: 1 },
  ],
  categories: [
    { id: "stay", mode: "place", parentId: null, name: { ja: "宿" }, icon: "bed", sort: 1 },
    { id: "coast", mode: "place", parentId: null, name: { ja: "海辺" }, icon: "sun", sort: 2 },
    { id: "onsen", mode: "experience", parentId: null, name: { ja: "温泉" }, icon: "steam", sort: 1 },
    { id: "hike", mode: "experience", parentId: null, name: { ja: "ハイキング" }, icon: "hike", sort: 2 },
  ],
  spots: [
    spot("lake-inn", "stay", "ashinoko", ["stay"], 2),
    spot("gora-inn", "stay", "gora", ["stay"], 1),
    spot("shimoda-inn", "stay", "shimoda", ["stay", "coast"], 3),
    spot("lake-walk", "experience", "ashinoko", ["hike"], 4),
    spot("gora-bath", "experience", "gora", ["onsen"], 5),
    spot("shimoda-hike", "experience", "shimoda", ["hike"], 6),
  ],
};

const run = (q: Partial<DiscoverQuery>) =>
  buildFeed({ catalog, query: { ...DEFAULT_QUERY, ...q }, locale: "ja" }, loadFeedStrategies({}));

describe("parseDiscoverQuery / serializeDiscoverQuery", () => {
  it("不正値は既定に戻す", () => {
    expect(parseDiscoverQuery({ mode: "x", sort: "y", area: "A B", cat: "<s>" })).toEqual(DEFAULT_QUERY);
  });
  it("往復で同じ条件になる", () => {
    const q: DiscoverQuery = { mode: "experience", area: "gora", cat: "onsen", sort: "fresh", q: "湯" };
    const url = serializeDiscoverQuery(q);
    expect(parseDiscoverQuery(Object.fromEntries(new URLSearchParams(url.slice(2))))).toEqual(q);
  });
  it("既定値は URL から省く", () => {
    expect(serializeDiscoverQuery(DEFAULT_QUERY)).toBe("/");
  });
});

describe("buildFeed", () => {
  it("Place モードは場所だけを編集部の順で並べる", () => {
    const feed = run({});
    expect(feed.cards.map((c) => c.key)).toEqual(["gora-inn", "lake-inn", "shimoda-inn"]);
    expect(feed.orderLabel).toBe("編集部のおすすめ順");
  });
  it("カテゴリとエリアで即時に絞り込める", () => {
    expect(run({ cat: "coast" }).cards.map((c) => c.key)).toEqual(["shimoda-inn"]);
    expect(run({ area: "hakone" }).cards.map((c) => c.key)).toEqual(["gora-inn", "lake-inn"]);
    expect(run({ area: "gora" }).cards.map((c) => c.key)).toEqual(["gora-inn"]);
  });
  it("関連タイルは同じ地域の体験で、同じ地区を先に出す", () => {
    const lake = run({ area: "ashinoko" }).cards[0];
    expect(lake.tiles.map((x) => x.spotId)).toEqual(["lake-walk"]);
    const gora = run({ cat: "stay", area: "hakone" }).cards[0];
    expect(gora.tiles.map((x) => x.spotId)[0]).toBe("gora-bath");
  });
  it("Experience モードは体験の種類ごとに 1 枚にまとめる", () => {
    const feed = run({ mode: "experience" });
    // 並びは並べ方の戦略（代表スポットの編集部の順）が決める
    expect(feed.cards.map((c) => c.title)).toEqual(["ハイキング", "温泉"]);
    expect(feed.cards[0].areaLabel).toBe("2か所で体験できる");
  });
  it("該当なしは理由つきで空を返す", () => {
    const feed = run({ q: "存在しない" });
    expect(feed.cards).toEqual([]);
    expect(feed.emptyReason).toBe("no-match");
  });
  it("新着順に切り替えられる", () => {
    const feed = run({ sort: "fresh" });
    expect(feed.orderLabel).toBe("新着順");
    expect(feed.cards[0].key).toBe("shimoda-inn");
  });
});

describe("dedupeRelatedTiles", () => {
  const tile = (id: string): Tile => ({ spotId: id, label: id, sub: "", photo: null, href: "" });
  it("隣のカードと同じタイルを間引く", () => {
    const out = dedupeRelatedTiles([[tile("a"), tile("b")], [tile("a"), tile("c")]]);
    expect(out[1].map((x) => x.spotId)).toEqual(["c"]);
  });
  it("全部重複なら元のタイルを残す", () => {
    const out = dedupeRelatedTiles([[tile("a")], [tile("a")]]);
    expect(out[1].map((x) => x.spotId)).toEqual(["a"]);
  });
});

describe("resolveLocalizedText", () => {
  it("訳が無ければ他の言語で出し、代替した印を付ける", () => {
    expect(resolveLocalizedText({ ja: "宿" }, "en")).toEqual({ text: "宿", fallback: true });
    expect(resolveLocalizedText({ ja: "宿", en: "Stay" }, "en")).toEqual({ text: "Stay", fallback: false });
  });
});
