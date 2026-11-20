import { describe, expect, it } from "vitest";
import {
  additivePreference,
  allReacted,
  applyChoice,
  applyReaction,
  applyRound,
  conditionFeatures,
  defaultStrategies,
  entropyChooser,
  featureLabeler,
  guardedLead,
  initialState,
  mmrPicker,
  nextRound,
  reactionCause,
  templateLead,
  toCandidates,
  type Candidate,
  type LeadText,
  type ProposeState,
} from "./index";
import { similarity, splitEntropy } from "./score";

const C = (id: string, ...features: string[]): Candidate => ({ id, name: id.toUpperCase(), features });
const all: Candidate[] = [
  C("inn", "kind:accommodation", "trait:lake", "area:ashinoko"),
  C("canoe", "kind:experience", "trait:lake", "area:ashinoko"),
  C("forest", "kind:accommodation", "trait:onsen", "area:sengokuhara"),
  C("walk", "kind:nature", "trait:lake", "area:ashinoko"),
  C("lodge", "kind:accommodation", "trait:plateau", "area:sengokuhara"),
  C("stars", "kind:experience", "trait:plateau", "area:sengokuhara"),
];
const byId = new Map(all.map((c) => [c.id, c]));
const ctxOf = (state: ProposeState) => ({ state, featuresOf: (id: string) => byId.get(id)?.features ?? [] });
const text: LeadText = {
  start: (n) => `まず ${n} 件`,
  choice: (l) => `「${l}」で`,
  great: (n, l) => `${n} が気に入ったなら ${l ?? ""}`,
  good: (n) => `${n} に合いそう`,
  hmm: (n) => `${n} とはちがう`,
  next: () => "ほかにも",
  end: () => "ここまで",
};
const labelOf = (f: string) => f;

describe("score", () => {
  it("近さと分け方の良さ", () => {
    expect(similarity(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
    expect(similarity([], [])).toBe(0);
    expect(splitEntropy(0.5)).toBe(1);
    expect(splitEntropy(1)).toBe(0);
  });
});

describe("additivePreference", () => {
  it("条件・リアクション（特徴の数で割る）・選択肢（回で弱める）を足す", () => {
    const state: ProposeState = { ...initialState(["trait:lake"]), reactions: { forest: "great", canoe: "hmm" }, choices: [{ feature: "kind:nature", round: 0 }], round: 1 };
    const w = additivePreference().weigh(ctxOf(state));
    expect(w.get("trait:lake")).toBeCloseTo(1 - 1.5 / 3);
    expect(w.get("trait:onsen")).toBeCloseTo(2 / 3);
    expect(w.get("kind:nature")).toBeCloseTo(2 * 0.7);
  });
});

describe("mmrPicker", () => {
  it("点数順だが、似たものが続かない", () => {
    const w = new Map([["trait:lake", 2], ["area:ashinoko", 1], ["kind:accommodation", 0.5]]);
    const near = mmrPicker({ n: 2, lambda: 0, explore: false }).pick(all, w, ctxOf(initialState([])));
    expect(near).toEqual(["inn", "canoe"]); // 似ていても気にしなければ点数順
    const ids = mmrPicker({ n: 2, lambda: 10, explore: false }).pick(all, w, ctxOf(initialState([])));
    expect(ids).toEqual(["inn", "stars"]); // inn と重なる canoe・walk は下がり、重ならない stars が上がる
  });
  it("2 回目からは、見ていない種類を 1 枠入れる", () => {
    const state = { ...initialState([]), shown: ["inn", "forest"], round: 1 };
    const pool = all.filter((c) => !state.shown.includes(c.id));
    const w = new Map([["kind:accommodation", 5]]);
    const ids = mmrPicker({ n: 2, lambda: 0, explore: true }).pick(pool, w, ctxOf(state));
    expect(ids[0]).toBe("lodge");
    expect(["canoe", "walk", "stars"]).toContain(ids[1]);
  });
});

describe("entropyChooser", () => {
  it("半々に分ける特徴を先に。条件・選んだもの・好みがマイナスのもの・分けられないものは外す", () => {
    const state = { ...initialState(["trait:lake"]), choices: [{ feature: "area:ashinoko", round: 0 }] };
    const w = new Map([["kind:experience", -1]]);
    const out = entropyChooser({ max: 10, minSplit: 0.1, maxSplit: 0.9, perType: 10 }).choose(all, w, ctxOf(state)).map((c) => c.feature);
    expect(out[0]).toBe("kind:accommodation"); // 3/6
    expect(out).not.toContain("trait:lake");
    expect(out).not.toContain("area:ashinoko");
    expect(out).not.toContain("kind:experience");
  });
  it("同じ型は perType まで", () => {
    const out = entropyChooser({ max: 10, minSplit: 0, maxSplit: 1, perType: 1 }).choose(all, new Map(), ctxOf(initialState([])));
    const types = out.map((c) => c.feature.split(":")[0]);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("lead", () => {
  const lead = templateLead(text, labelOf);
  it("きっかけごとの一言。候補が無ければ終わり", () => {
    expect(lead.write({ cause: { type: "start" }, picked: [all[0]], topFeature: null })).toBe("まず 1 件");
    expect(lead.write({ cause: { type: "reaction", reaction: "great", id: "inn", name: "INN" }, picked: [all[1]], topFeature: "trait:lake" })).toBe("INN が気に入ったなら trait:lake");
    expect(lead.write({ cause: { type: "next" }, picked: [], topFeature: null })).toBe("ここまで");
  });
  it("書き手が候補に無い場所を出したら、テンプレートに戻す", () => {
    const bad = { name: "llm@0", write: () => "FOREST もどうぞ" };
    const g = guardedLead(bad, lead, all.map((c) => c.name));
    expect(g.write({ cause: { type: "start" }, picked: [all[0]], topFeature: null })).toBe("まず 1 件");
    const ok = { name: "llm@0", write: () => "INN はいかが" };
    expect(guardedLead(ok, lead, all.map((c) => c.name)).write({ cause: { type: "start" }, picked: [all[0]], topFeature: null })).toBe("INN はいかが");
  });
});

describe("nextRound と状態", () => {
  const s = defaultStrategies(text, labelOf);
  it("最初の回から、全部にリアクションして次の回へ。出したもの・うーんは二度と出ない", () => {
    let state = initialState(["trait:lake"]);
    const r1 = nextRound(state, { type: "start" }, all, s);
    expect(r1.ids).toHaveLength(3);
    expect(r1.lead).toBe("まず 3 件");
    expect(r1.algorithm).toBe("pref-additive@1 pick-mmr@1 choices-entropy@1 lead-template@1");
    state = applyRound(state, r1);
    expect(allReacted(state, r1.ids)).toBe(false);
    for (const id of r1.ids) state = applyReaction(state, id, id === r1.ids[0] ? "great" : "hmm");
    expect(allReacted(state, r1.ids)).toBe(true);
    const cause = reactionCause(state, r1.ids, (id) => byId.get(id)!.name);
    expect(cause).toMatchObject({ type: "reaction", reaction: "great", id: r1.ids[0] });
    const r2 = nextRound(state, cause, all, s);
    expect(r2.ids.some((id) => r1.ids.includes(id))).toBe(false);
    state = applyRound(state, r2);
    const r3 = nextRound(applyChoice(state, "kind:experience"), { type: "choice", feature: "kind:experience" }, all, s);
    expect(r3.done).toBe(true);
    expect(r3.lead).toBe("ここまで");
  });
});

describe("features", () => {
  it("カードを特徴にし、条件のキーワードを特徴にする", () => {
    const byRegion = { ashinoko: ["lake", "hike"], hakone: ["onsen"] };
    const [c] = toCandidates([{ destId: "d1", title: "宿", regionIds: ["ashinoko", "hakone"], coreType: "accommodation" }], byRegion, () => ["quiet"]);
    expect(c).toEqual({ id: "d1", name: "宿", features: ["trait:lake", "trait:hike", "kind:accommodation", "area:ashinoko", "dest:quiet"] });
    expect(conditionFeatures(["near_lake", "kind-village", "nope"])).toEqual(["trait:lake", "kind:village"]);
  });
  it("特徴の名前は型ごとの表から。無ければ id", () => {
    const label = featureLabeler({ trait: (id) => ({ lake: "湖畔" })[id], kind: () => undefined, area: () => "芦ノ湖" });
    expect(label("trait:lake")).toBe("湖畔");
    expect(label("kind:x")).toBe("x");
    expect(label("area:ashinoko")).toBe("芦ノ湖");
  });
});
