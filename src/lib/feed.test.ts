import { describe, expect, it } from "vitest";
import { parseDiscoverQuery, serializeDiscoverQuery, DEFAULT_QUERY } from "./discover-query";
import { buildFeed, dedupeRelatedTiles, resolveLocalizedText, type Catalog } from "./feed";
import { loadFeedStrategies } from "./feed-config";
import { MODES } from "./modes";
import type { DestCard, DiscoverQuery, Tile } from "./types";

const dest = (id: string, coreType: string, regionId: string, categoryIds: string[], day: number): DestCard => ({
  id, coreType, slug: id, regionId, categoryIds, isDemo: true, name: { ja: id }, summary: null, photos: [],
  createdAt: `2026-11-${String(10 - day).padStart(2, "0")}T00:00:00Z`,
  publishedAt: `2026-11-${String(day).padStart(2, "0")}T00:00:00Z`,
});

const catalog: Catalog = {
  regions: [
    { id: "hakone", parentId: null, name: { ja: "箱根" }, sort: 1 },
    { id: "ashinoko", parentId: "hakone", name: { ja: "芦ノ湖" }, sort: 1 },
    { id: "gora", parentId: "hakone", name: { ja: "強羅" }, sort: 2 },
    { id: "izu", parentId: null, name: { ja: "伊豆" }, sort: 2 },
    { id: "shimoda", parentId: "izu", name: { ja: "下田" }, sort: 1 },
  ],
  categories: [
    { id: "onsen", parentId: null, name: { ja: "温泉" }, icon: "steam", sort: 1 },
    { id: "coast", parentId: null, name: { ja: "海辺" }, icon: "sun", sort: 2 },
  ],
  dests: [
    dest("lake-inn", "accommodation", "ashinoko", ["onsen"], 2),
    dest("gora-inn", "accommodation", "gora", ["onsen"], 3),
    dest("shimoda-inn", "accommodation", "shimoda", ["coast"], 1),
    dest("lake-walk", "nature", "ashinoko", [], 4),
    dest("gora-bath", "hotspring", "gora", ["onsen"], 5),
    dest("shimoda-hike", "experience", "shimoda", [], 6),
  ],
};

const run = (q: Partial<DiscoverQuery>) =>
  buildFeed({ catalog, query: { ...DEFAULT_QUERY, ...q }, locale: "ja" }, loadFeedStrategies({}));

describe("parseDiscoverQuery / serializeDiscoverQuery", () => {
  it("不正値は既定に戻す", () => {
    expect(parseDiscoverQuery({ mode: "x", sort: "y", area: "A B", cat: "<s>" })).toEqual(DEFAULT_QUERY);
  });
  it("mode の既定は stay", () => {
    expect(DEFAULT_QUERY.mode).toBe("stay");
    expect(parseDiscoverQuery({ mode: "place" }).mode).toBe("stay");
  });
  it("往復で同じ条件になる", () => {
    const q: DiscoverQuery = { mode: "do", area: "gora", cat: "onsen", sort: "fresh", q: "湯" };
    const url = serializeDiscoverQuery(q);
    expect(parseDiscoverQuery(Object.fromEntries(new URLSearchParams(url.slice(2))))).toEqual(q);
  });
  it("既定値は URL から省く", () => {
    expect(serializeDiscoverQuery(DEFAULT_QUERY)).toBe("/");
  });
});

describe("buildFeed", () => {
  it("stay は accommodation だけを公開日の新しい順で並べる", () => {
    const feed = run({});
    expect(feed.cards.map((c) => c.key)).toEqual(["gora-inn", "lake-inn", "shimoda-inn"]);
    expect(feed.cards[0].kindLabel).toBe("宿");
    expect(feed.cards[0].href).toBe("/d/gora-inn");
    expect(feed.orderLabel).toBe("編集部のおすすめ順");
  });
  it("do は stay 以外の core_type を dest 単位で出す", () => {
    const feed = run({ mode: "do" });
    expect(feed.cards.map((c) => c.key)).toEqual(["shimoda-hike", "gora-bath", "lake-walk"]);
    const others = MODES.stay as readonly string[];
    expect(feed.cards.every((c) => !others.includes(catalog.dests.find((d) => d.id === c.key)!.coreType))).toBe(true);
  });
  it("カテゴリと地域で絞り込める", () => {
    expect(run({ cat: "coast" }).cards.map((c) => c.key)).toEqual(["shimoda-inn"]);
    expect(run({ area: "hakone" }).cards.map((c) => c.key)).toEqual(["gora-inn", "lake-inn"]);
    expect(run({ area: "gora" }).cards.map((c) => c.key)).toEqual(["gora-inn"]);
  });
  it("関連タイルは もう片方の mode の同じ地域で、同じ地区を先に出す", () => {
    const lake = run({ area: "ashinoko" }).cards[0];
    expect(lake.tiles.map((x) => x.destId)).toEqual(["lake-walk"]);
    const gora = run({ area: "hakone" }).cards[0];
    expect(gora.tiles.map((x) => x.destId)[0]).toBe("gora-bath");
    const bath = run({ mode: "do", area: "gora" }).cards[0];
    expect(bath.tiles.map((x) => x.destId)).toEqual(["gora-inn"]);
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
  const tile = (id: string): Tile => ({ destId: id, label: id, sub: "", photo: null, href: "" });
  it("隣のカードと同じタイルを間引く", () => {
    const out = dedupeRelatedTiles([[tile("a"), tile("b")], [tile("a"), tile("c")]]);
    expect(out[1].map((x) => x.destId)).toEqual(["c"]);
  });
  it("全部重複なら元のタイルを残す", () => {
    const out = dedupeRelatedTiles([[tile("a")], [tile("a")]]);
    expect(out[1].map((x) => x.destId)).toEqual(["a"]);
  });
});

describe("resolveLocalizedText", () => {
  it("訳が無ければ他の言語で出し、代替した印を付ける", () => {
    expect(resolveLocalizedText({ ja: "宿" }, "en")).toEqual({ text: "宿", fallback: true });
    expect(resolveLocalizedText({ ja: "宿", en: "Stay" }, "en")).toEqual({ text: "Stay", fallback: false });
  });
});
