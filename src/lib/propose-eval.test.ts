import { describe, expect, it } from "vitest";
import { defaultStrategies, type Candidate } from "./propose";
import { simulate } from "./propose/simulate";
import { evaluate, km } from "./propose-eval";

const C = (id: string, ...features: string[]): Candidate => ({ id, name: id, features });
const all = [
  C("s1", "kind:accommodation", "trait:onsen", "area:a"),
  C("s2", "kind:accommodation", "dest:quiet", "area:b"),
  C("x1", "kind:nature", "trait:onsen", "area:a"),
  C("x2", "kind:experience", "dest:quiet", "area:a"),
  C("x3", "kind:nature", "area:c"),
  C("x4", "kind:experience", "area:a"),
  C("x5", "kind:nature", "area:b"),
  C("x6", "kind:village", "area:a"),
];
const text = { start: () => "s", choice: () => "c", great: () => "g", good: () => "o", hmm: () => "h", next: () => "n", end: () => "e" };

describe("simulate", () => {
  it("1 件目にすごくいい、残りにうーんで、ゴールがそろうまで動かす", () => {
    const sim = simulate(all, ["trait:onsen", "dest:quiet"], defaultStrategies(text, (f) => f));
    expect(sim.goal?.complete).toBe(true);
    expect(sim.roundsToPlan).toBe(sim.rounds.length);
    expect(sim.rounds[0].cause).toBe("start");
    expect(sim.algorithm).toContain("goal-plan@1");
  });
});

describe("evaluate", () => {
  it("合っている割合・場所の特徴の割合・理由・捨てた条件・地理", () => {
    const sim = { rounds: [{ cause: "start" as const, lead: "", ids: ["s1", "s2"] }, { cause: "reaction" as const, lead: "", ids: ["x3"] }], goal: { stay: "s1", activities: ["x3"], target: null, complete: true }, roundsToPlan: 2, algorithm: "a" };
    const m = evaluate(
      { picked: ["onsen", "quiet", "forest"], conditions: ["trait:onsen", "dest:quiet"], candidates: all, sim, coords: { s1: { lat: 35, lng: 139 }, x3: { lat: 35.1, lng: 139 } } },
      (k) => ({ onsen: ["trait:onsen"], quiet: ["dest:quiet"] })[k] ?? [],
    );
    expect(m).toMatchObject({ pool: 8, shown: 3, dropped: ["forest"], fit: 0.67, placeFit: 0.33, reasonTruth: 0.5, variety: 1, roundsToPlan: 2, planMaxKm: 11.1 });
  });
  it("距離", () => expect(km({ lat: 35, lng: 139 }, { lat: 35, lng: 139 })).toBe(0));
});
