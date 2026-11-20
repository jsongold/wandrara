import { describe, expect, it } from "vitest";
import type { EvalMetrics } from "../../src/lib/propose-eval.ts";
import { attachJudges, compareMarkdown, fitMean, judgePrompt, parseJudge, summarize, verdict, worstByFit, type Judge, type Run, type ScenarioResult } from "./report.ts";

const metrics = (o: Partial<EvalMetrics> = {}): EvalMetrics => ({
  pool: 10, shown: 6, dropped: [], fit: 0.5, placeFit: 0.5, reasonTruth: 0.5, variety: 0.5,
  roundsToPlan: 2, planMaxKm: 5, feasible: true, tapsToPlan: 6, ...o,
});
const judge = (fit: number, o: Partial<Judge> = {}): Judge => ({ fit, reason: `理由${fit}`, rounds: [fit], missing: [`足りない${fit}`], wrong: [], ...o });
const scenario = (id: string, m: EvalMetrics | null, j?: Judge): ScenarioResult => ({
  id, who: `誰-${id}`, want: `したい-${id}`, query: {},
  ...(m
    ? { result: { name: id, trip: "2 人", conditions: ["湖畔"], algorithm: "a@1", metrics: m, rounds: [{ cause: "start", lead: "どうぞ", cards: [{ name: "宿A", kind: "宿", area: "仙石原", features: ["露天風呂"], areaTraits: ["湖畔"] }] }], plan: ["宿A", "滝B"] } }
    : { error: "500" }),
  ...(j ? { judge: j } : {}),
});
const run = (scenarios: ScenarioResult[], o: Partial<Run> = {}): Run => ({ at: "2026-11-20T00:00:00Z", base: "x", algorithm: "a@1", scenarios, ...o });

describe("summarize / fitMean", () => {
  it("機械の指標の平均は null と失敗を除く", () => {
    const s = summarize(run([scenario("a", metrics({ fit: 0.2 })), scenario("b", metrics({ fit: 0.4, roundsToPlan: null })), scenario("c", null)]));
    expect(s.fit).toBe(0.3);
    expect(s.planRate).toBe(0.5);
  });
  it("fit の平均は採点したシナリオだけ。無ければ null", () => {
    expect(fitMean(run([scenario("a", metrics(), judge(2)), scenario("b", metrics(), judge(5)), scenario("c", metrics())]))).toBe(3.5);
    expect(fitMean(run([scenario("a", metrics())]))).toBeNull();
  });
});

describe("worstByFit", () => {
  it("fit の低い順、採点の無いものは除く", () => {
    const w = worstByFit(run([scenario("a", metrics(), judge(4)), scenario("b", metrics(), judge(1)), scenario("c", metrics()), scenario("d", metrics(), judge(2))]), 2);
    expect(w.map((x) => x.id)).toEqual(["b", "d"]);
  });
});

describe("verdict", () => {
  it("良い向きで判定する", () => {
    expect(verdict("high", 0.2, 0.3)).toBe("良くなった");
    expect(verdict("low", 2, 3)).toBe("悪くなった");
    expect(verdict("low", 2, 2)).toBe("同じ");
    expect(verdict("high", null, 1)).toBe("");
  });
});

describe("compareMarkdown", () => {
  it("未採点なら fit は未採点、取り込み方を案内する", () => {
    const md = compareMarkdown(null, run([scenario("a", metrics())]));
    expect(md).toContain("| - | 未採点 |  |  |");
    expect(md).toContain("pnpm propose:eval:judge");
    expect(md).toContain("| a | 誰-a | 未採点 |");
  });
  it("fit の平均・低いシナリオ（足りないもの）を先に、機械の指標は後に出す", () => {
    const prev = run([scenario("a", metrics(), judge(2)), scenario("b", metrics(), judge(4))]);
    const cur = run([scenario("a", metrics({ fit: 0.8 }), judge(4)), scenario("b", metrics(), judge(3))], { judgedAt: "t" });
    const md = compareMarkdown(prev, cur);
    expect(md).toContain("| 3 | 3.5 | +0.5 | 良くなった |");
    expect(md).toContain("1. 誰-b（fit 3）理由3");
    expect(md).toContain("   - 足りないもの：足りない3");
    expect(md).toContain("| a | 誰-a | 4 | +2 | 4 | 足りない4 | - | 0.8 |");
    expect(md.indexOf("fit が低い")).toBeLessThan(md.indexOf("参考：機械の指標"));
    expect(md).toContain("| 条件に合う割合 | 高い | 0.5 | 0.65 | +0.15 | 良くなった |");
  });
  it("失敗したシナリオも行に出し、| をこわさない", () => {
    const md = compareMarkdown(null, run([scenario("x", null), scenario("y", metrics(), judge(1, { missing: ["a|b"] }))]));
    expect(md).toContain("| x | 誰-x | 失敗：500 |");
    expect(md).toContain("a／b");
  });
});

describe("judgePrompt", () => {
  it("who・want・各回の提案（種類・エリア・特徴）・プランと返す形を並べる", () => {
    const p = judgePrompt(run([scenario("a", metrics()), scenario("b", null)]));
    for (const k of ["fit", "reason", "rounds", "missing", "wrong"]) expect(p).toContain(`- ${k}：`);
    expect(p).toContain('"id":"<シナリオの id>"');
    expect(p).toContain("### a");
    expect(p).toContain("- 誰が：誰-a");
    expect(p).toContain("- したいこと：したい-a");
    expect(p).toContain("1 回目「どうぞ」");
    expect(p).toContain("  - 宿A（種類：宿／エリア：仙石原／場所の特徴：露天風呂／地区の特性：湖畔）");
    expect(p).toContain("その場所自体にあるとは限りません");
    expect(p).toContain("最後のプラン：宿A → 滝B");
    expect(p).toContain("取得に失敗：500");
  });
});

describe("parseJudge", () => {
  const ok = { id: "a", fit: 3, reason: "r", rounds: [4, 2], missing: ["m"], wrong: [] };
  it("```json の囲みと前後の文があっても読む", () => {
    const { judges, errors } = parseJudge(`はい\n\`\`\`json\n${JSON.stringify([ok])}\n\`\`\`\n以上`, ["a"]);
    expect(judges.a).toEqual({ fit: 3, reason: "r", rounds: [4, 2], missing: ["m"], wrong: [] });
    expect(errors).toEqual([]);
  });
  it("囲みが無くても配列を読む", () => {
    expect(parseJudge(`結果：${JSON.stringify([ok])}`, ["a"]).judges.a.fit).toBe(3);
  });
  it("知らない id・範囲外の点・足りないシナリオを errors に", () => {
    const { judges, errors } = parseJudge(JSON.stringify([{ ...ok, id: "z" }, { ...ok, id: "b", fit: 6 }]), ["a", "b"]);
    expect(judges).toEqual({});
    expect(errors).toEqual(["知らない id：z", "形が違う：b", "採点が無い：a"]);
  });
  it("JSON でなければ errors", () => {
    expect(parseJudge("だめ", ["a"]).errors).toEqual(["JSON として読めない"]);
  });
});

describe("attachJudges", () => {
  it("採点のあるシナリオにだけ付ける", () => {
    const r = attachJudges(run([scenario("a", metrics()), scenario("b", metrics())]), { a: judge(5) }, "t");
    expect(r.judgedAt).toBe("t");
    expect(r.scenarios[0].judge?.fit).toBe(5);
    expect(r.scenarios[1].judge).toBeUndefined();
  });
});
