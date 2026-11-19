import { describe, expect, it } from "vitest";
import { cardTraitIds, orderBySuggest, suggestReason } from "./suggest";

const byRegion = { hakone: ["onsen", "hike"], kanagawa: ["coast"], nagano: ["plateau", "lake"] };
const traits = [
  { id: "onsen", label: "温泉", icon: "steam" },
  { id: "coast", label: "海辺", icon: "sun" },
  { id: "plateau", label: "高原", icon: "tree" },
  { id: "lake", label: "湖畔", icon: "wave" },
  { id: "hike", label: "山歩き", icon: "hike" },
];

describe("cardTraitIds", () => {
  it("地区と親の特性を重複なしで合わせる", () => {
    expect(cardTraitIds(["hakone", "kanagawa"], byRegion)).toEqual(["onsen", "hike", "coast"]);
    expect(cardTraitIds(["unknown"], byRegion)).toEqual([]);
  });
});

describe("orderBySuggest", () => {
  const cards = [
    { id: "a", t: ["coast"] },
    { id: "b", t: ["plateau"] },
    { id: "c", t: ["onsen", "hike"] },
    { id: "d", t: ["onsen"] },
    { id: "e", t: [] },
  ];
  const ids = (xs: typeof cards) => xs.map((x) => x.id);
  it("条件が無ければそのまま", () => {
    expect(orderBySuggest(cards, 0, [], (c) => c.t)).toBe(cards);
  });
  it("pivot までは動かさず、先を合う数の多い順（同数は元の順）にする。件数は減らない", () => {
    expect(ids(orderBySuggest(cards, 0, ["onsen", "hike"], (c) => c.t))).toEqual(["a", "c", "d", "b", "e"]);
  });
  it("pivot が -1 なら全部を並べ替える", () => {
    expect(ids(orderBySuggest(cards, -1, ["plateau"], (c) => c.t))).toEqual(["b", "a", "c", "d", "e"]);
  });
});

describe("suggestReason", () => {
  it("選んだ条件に合えばそれを理由にする", () => {
    expect(suggestReason(["onsen", "hike"], ["hike", "lake"], traits)).toEqual({ kind: "match", traits: [traits[4]] });
  });
  it("合わなければカードの特性の先頭（マスターの順）", () => {
    expect(suggestReason(["hike", "onsen"], ["lake"], traits)).toEqual({ kind: "trait", traits: [traits[0]] });
  });
  it("特性が無ければ null", () => {
    expect(suggestReason([], ["lake"], traits)).toBeNull();
  });
});
