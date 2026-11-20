import { describe, expect, it } from "vitest";
import { cardTraitIds, countMatching, hasData, inArea, matchedKeywords, orderBySuggest, parseSuggestArea, proposalName, parseSuggestTraits, suggestPlanHref, type PlanItem } from "./suggest";

const byRegion = { hakone: ["onsen", "hike"], ashinoko: ["lake", "hike"], izu: ["coast"], ito: ["coast", "plateau"] };
const match = { near_lake: { trait: "lake" }, near_sea: { trait: "coast" }, plateau: { trait: "plateau" }, "kind-nature": { core: "nature" } };
const items: PlanItem[] = [
  { regionIds: ["ashinoko", "hakone"], coreType: "accommodation" },
  { regionIds: ["ashinoko", "hakone"], coreType: "nature" },
  { regionIds: ["ito", "izu"], coreType: "accommodation" },
  { regionIds: ["unknown", "izu"], coreType: "nature" },
];

describe("cardTraitIds", () => {
  it("地区の特性を使い、親は合わせない。地区に無ければ親", () => {
    expect(cardTraitIds(["ashinoko", "hakone"], byRegion)).toEqual(["lake", "hike"]);
    expect(cardTraitIds(["unknown", "izu"], byRegion)).toEqual(["coast"]);
    expect(cardTraitIds(["unknown"], byRegion)).toEqual([]);
  });
});

describe("matchedKeywords", () => {
  it("特性と種類で当てはまるキーワードを返す。値の無いキーワードは返さない", () => {
    expect(matchedKeywords(items[1], ["near_lake", "kind-nature", "quiet"], byRegion, match)).toEqual(["near_lake", "kind-nature"]);
    expect(matchedKeywords(items[2], ["near_lake", "near_sea", "plateau"], byRegion, match)).toEqual(["near_sea", "plateau"]);
  });
  it("hasData は値を持つキーワードだけ true", () => {
    expect(hasData("near_lake", match)).toBe(true);
    expect(hasData("quiet", match)).toBe(false);
  });
});

describe("countMatching", () => {
  it("エリアの中で、値を持つキーワードをすべて満たす数。値の無いキーワードは数えない", () => {
    expect(countMatching(items, [], "all", byRegion, match)).toBe(4);
    expect(countMatching(items, ["near_lake"], "all", byRegion, match)).toBe(2);
    expect(countMatching(items, ["near_lake", "kind-nature"], "all", byRegion, match)).toBe(1);
    expect(countMatching(items, ["near_sea", "quiet"], "izu", byRegion, match)).toBe(2);
    expect(countMatching(items, ["near_lake"], "izu", byRegion, match)).toBe(0);
  });
  it("inArea は地区でも親でも合う", () => {
    expect(inArea(items[0], "hakone")).toBe(true);
    expect(inArea(items[0], "ashinoko")).toBe(true);
    expect(inArea(items[0], "izu")).toBe(false);
  });
});

describe("orderBySuggest", () => {
  const cards = [{ id: "a", t: ["x"] }, { id: "b", t: ["y"] }, { id: "c", t: ["y", "z"] }, { id: "d", t: [] as string[] }];
  const ids = (xs: typeof cards) => xs.map((x) => x.id);
  it("条件が無ければそのまま", () => {
    expect(orderBySuggest(cards, -1, [], (c) => c.t)).toBe(cards);
  });
  it("合う数の多い順（同数は元の順）。pivot までは動かさない。件数は減らない", () => {
    expect(ids(orderBySuggest(cards, -1, ["y", "z"], (c) => c.t))).toEqual(["c", "b", "a", "d"]);
    expect(ids(orderBySuggest(cards, 0, ["y", "z"], (c) => c.t))).toEqual(["a", "c", "b", "d"]);
  });
});

describe("提案ページの URL", () => {
  it("?t= を読み、形の違うもの・重複を捨てる（下線を含む id も通す）", () => {
    expect(parseSuggestTraits("near_lake,kind-nature,near_lake,BAD,,x y")).toEqual(["near_lake", "kind-nature"]);
    expect(parseSuggestTraits(undefined)).toEqual([]);
  });
  it("?area= を読み、無い・形の違うものは all", () => {
    expect(parseSuggestArea("hakone")).toBe("hakone");
    expect(parseSuggestArea("../x")).toBe("all");
    expect(parseSuggestArea(undefined)).toBe("all");
  });
  it("条件とエリアを URL にし、読み戻すと同じ", () => {
    expect(suggestPlanHref("ja", ["near_lake", "plateau"], "hakone")).toBe("/ja/plan?t=near_lake,plateau&area=hakone");
    expect(suggestPlanHref("en", [])).toBe("/en/plan");
    const u = new URL(`http://x${suggestPlanHref("ja", ["near_lake", "kind-nature"], "izu")}`);
    expect(parseSuggestTraits(u.searchParams.get("t") ?? undefined)).toEqual(["near_lake", "kind-nature"]);
    expect(parseSuggestArea(u.searchParams.get("area") ?? undefined)).toBe("izu");
  });
});

describe("proposalName", () => {
  const t = { all: "すべてのエリア", sep: "・", more: (n: number) => ` ほか ${n}` };
  it("エリアとこだわりをつなぐ", () => {
    expect(proposalName("箱根", ["湖の近く", "静か"], t)).toBe("箱根・湖の近く・静か");
  });
  it("エリアが無ければすべてのエリア、多ければ先頭 3 個とほか N", () => {
    expect(proposalName(null, ["森", "静か", "小さな宿", "サウナ", "朝食"], t)).toBe("すべてのエリア・森・静か・小さな宿 ほか 2");
  });
});
