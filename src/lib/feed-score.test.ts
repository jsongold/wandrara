import { describe, expect, it } from "vitest";
import { examination, scoreDests, type ActionCount, type FeedWeights } from "./feed-score";

const W: FeedWeights = { version: 0, actions: { card_click: 1, tile_click: 1.5, save: 8 }, priorStrength: 10 };
const view = (destId: string, n: number, position = 0): ActionCount => ({ destId, action: "card_view", position, n });
const click = (destId: string, n: number): ActionCount => ({ destId, action: "card_click", position: 0, n });

describe("examination", () => {
  it("上の位置ほど大きく、0 位は 1", () => {
    expect(examination(0)).toBe(1);
    expect(examination(1)).toBeLessThan(1);
    expect(examination(6)).toBeLessThan(examination(1));
  });
});

describe("scoreDests", () => {
  const targets = [
    { destId: "a", coreType: "stay" },
    { destId: "b", coreType: "stay" },
    { destId: "new", coreType: "stay" },
  ];

  it("表示が無い dest は種類の平均になる", () => {
    const { scores, priors } = scoreDests(targets, [view("a", 100), click("a", 10), view("b", 100)], W);
    expect(priors.get("stay")).toBeCloseTo(10 / 200);
    expect(scores.get("new")).toBeCloseTo(10 / 200);
  });

  it("よく押される dest が上、押されない dest が下", () => {
    const { scores } = scoreDests(targets, [view("a", 100), click("a", 10), view("b", 100)], W);
    expect(scores.get("a")!).toBeGreaterThan(scores.get("new")!);
    expect(scores.get("new")!).toBeGreaterThan(scores.get("b")!);
  });

  it("回数が少ないうちは平均に寄る（表示 1 回・クリック 1 回は率 100% ではなく、平均 10% の近くにとどまる）", () => {
    const { scores } = scoreDests(targets, [view("a", 1000), click("a", 100), view("b", 1), click("b", 1)], W);
    expect(scores.get("b")!).toBeLessThan(0.2);
    expect(scores.get("b")!).toBeGreaterThan(scores.get("a")!);
  });

  it("下の位置で同じだけ押されたほうが点が高い（位置の偏りの補正）", () => {
    const { scores } = scoreDests(targets, [view("a", 100, 0), click("a", 5), view("b", 100, 8), click("b", 5)], W);
    expect(scores.get("b")!).toBeGreaterThan(scores.get("a")!);
  });

  it("保存は重く数える", () => {
    const { scores } = scoreDests(
      targets,
      [view("a", 100), click("a", 8), view("b", 100), { destId: "b", action: "save", position: null, n: 1 }, click("b", 1)],
      W,
    );
    expect(scores.get("b")!).toBeGreaterThan(scores.get("a")!);
  });

  it("対象に無い dest の回数は無視する。記録が無ければ全部 0", () => {
    expect(scoreDests(targets, [view("gone", 5), click("gone", 5)], W).scores.get("a")).toBe(0);
  });

  it("種類ごとに平均を分ける", () => {
    const { priors } = scoreDests(
      [{ destId: "s", coreType: "stay" }, { destId: "e", coreType: "experience" }],
      [view("s", 10), click("s", 1), view("e", 10)],
      W,
    );
    expect(priors.get("stay")).toBeCloseTo(0.1);
    expect(priors.get("experience")).toBe(0);
  });
});
