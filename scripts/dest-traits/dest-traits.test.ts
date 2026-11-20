import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { agreement, buildPrompt, parseResponse, pickVerifySample, PICKED_TRAIT_IDS, sample, traitsFor, type DestText } from "./judge.ts";
import { appliesTo, parseTraitTsv, traitSeedSql } from "./trait-defs.ts";

const TSV = [
  "id\t名前\t大分類\t分類\t対象\t型\t作り方\t参考\t2周目との相性",
  "quiet\t静か\t静けさ\t音と近所\t全部\tflag\t紹介文\t\t◎",
  "beginner_ok\t初心者向け\t体験の形\t体力・難しさ\t体験\tflag\t紹介文\t\t○",
  "rotenburo\t露天風呂\t温泉・風呂\t風呂の種類\t宿・温泉\tflag\t紹介文\t\t○",
  "elevation_m\t標高\t立地\t山・地形\t全部\tnumber(m)\t位置\tDEM\t○",
  "mood_x\t'引用'\t雰囲気\t空気感\t宿\tlevel(0-3)\t計算（所要時間）\t\t△",
].join("\n");

describe("parseTraitTsv", () => {
  const defs = parseTraitTsv(TSV);

  it("型と作り方を分ける", () => {
    expect(defs.map((d) => [d.id, d.valueType, d.unit, d.source, d.method])).toEqual([
      ["quiet", "flag", null, "text", null],
      ["beginner_ok", "flag", null, "text", null],
      ["rotenburo", "flag", null, "text", null],
      ["elevation_m", "number", "m", "location", null],
      ["mood_x", "level", null, "calc", "所要時間"],
    ]);
  });

  it("id の重なり・正しくない id・読めない作り方は throw", () => {
    expect(() => parseTraitTsv(`${TSV}\nquiet\ta\tb\tc\t全部\tflag\t紹介文`)).toThrow("重なっている");
    expect(() => parseTraitTsv(`${TSV}\nBad Id\ta\tb\tc\t全部\tflag\t紹介文`)).toThrow("id が正しくない");
    expect(() => parseTraitTsv(`${TSV}\nz\ta\tb\tc\t全部\tflag\tその他`)).toThrow("作り方");
  });

  it("実際の定義表（463 件）を全部読める", () => {
    const real = parseTraitTsv(fs.readFileSync(new URL("../../docs/suggest/trait-candidates.tsv", import.meta.url), "utf8"));
    expect(real).toHaveLength(463);
  });
});

describe("traitSeedSql", () => {
  it("引用符を二重にし、既存の行は定義表の列だけ更新する", () => {
    const sql = traitSeedSql(parseTraitTsv(TSV));
    expect(sql).toContain(`('mood_x', '{"ja":"''引用''"}', 'level', null, 'calc', '所要時間'`);
    expect(sql).toContain("on conflict (id) do update set big = excluded.big");
    expect(sql).not.toContain("excluded.source");
  });

  it("migration の seed は今の定義表と同じ（定義表を変えたら pnpm dest-traits:seed-sql で migration を作り直す）", () => {
    const real = parseTraitTsv(fs.readFileSync(new URL("../../docs/suggest/trait-candidates.tsv", import.meta.url), "utf8"));
    const dir = new URL("../../supabase/migrations/", import.meta.url);
    const file = fs.readdirSync(dir).find((f) => f.endsWith("_dest_traits.sql"))!;
    expect(fs.readFileSync(new URL(file, dir), "utf8")).toContain(traitSeedSql(real));
  });
});

describe("appliesTo", () => {
  it("対象に dest の種類が入るか", () => {
    expect(appliesTo("全部", "village")).toBe(true);
    expect(appliesTo("宿・温泉", "hotspring")).toBe(true);
    expect(appliesTo("宿・温泉", "experience")).toBe(false);
    expect(appliesTo("体験", "accommodation")).toBe(false);
  });
});

describe("選んだ 30 件", () => {
  it("定義表に全部あり、紹介文の flag で、重ならない", () => {
    const real = parseTraitTsv(fs.readFileSync(new URL("../../docs/suggest/trait-candidates.tsv", import.meta.url), "utf8"));
    const byId = new Map(real.map((d) => [d.id, d]));
    expect(PICKED_TRAIT_IDS).toHaveLength(30);
    expect(new Set(PICKED_TRAIT_IDS).size).toBe(30);
    for (const id of PICKED_TRAIT_IDS) expect([id, byId.get(id)?.source, byId.get(id)?.valueType]).toEqual([id, "text", "flag"]);
  });
});

const dest: DestText = { destId: "d1", coreType: "accommodation", name: "森の宿", summary: "静かな森に囲まれた一棟貸し。露天風呂が付く。" };
const defs = parseTraitTsv(TSV);

describe("traitsFor / buildPrompt", () => {
  it("対象が合う特徴だけ尋ね、紹介文と特徴の一覧をプロンプトに入れる", () => {
    const asked = traitsFor(dest, defs);
    expect(asked.map((t) => t.id)).toEqual(["quiet", "rotenburo", "elevation_m", "mood_x"]);
    const p = buildPrompt(dest, asked.slice(0, 2));
    expect(p.user).toContain("紹介文: 静かな森に囲まれた一棟貸し。露天風呂が付く。");
    expect(p.user).toContain("- quiet: 静か\n- rotenburo: 露天風呂");
    expect(p.system).toContain("推測しない");
  });
});

describe("parseResponse", () => {
  const asked = [{ id: "quiet" }, { id: "rotenburo" }, { id: "beginner_ok" }];
  const res = (results: unknown[]) => `説明\n${JSON.stringify({ results })}`;

  it("紹介文からの引用がある判定だけ通す", () => {
    const r = parseResponse(res([{ trait_id: "quiet", evidence: "静かな森に囲まれた", confidence: 0.9 }]), dest, asked);
    expect(r.accepted).toEqual([{ traitId: "quiet", evidence: "静かな森に囲まれた", confidence: 0.9 }]);
    expect(r.rejected).toEqual([]);
  });

  it("空白・全角半角の違いは引用として通す", () => {
    const d = { ...dest, summary: "Quiet  forest ＩＮＮ" };
    expect(parseResponse(res([{ trait_id: "quiet", evidence: "quiet forest INN", confidence: 0.7 }]), d, asked).accepted).toHaveLength(1);
  });

  it("根拠が紹介文に無い・空・confidence が範囲外や低い・尋ねていない・重複は除き、理由を残す", () => {
    const r = parseResponse(
      res([
        { trait_id: "quiet", evidence: "海が見える", confidence: 0.9 },
        { trait_id: "rotenburo", evidence: "", confidence: 0.9 },
        { trait_id: "rotenburo", evidence: "露天風呂", confidence: 1.5 },
        { trait_id: "rotenburo", evidence: "露天風呂", confidence: 0.3 },
        { trait_id: "sauna", evidence: "露天風呂", confidence: 0.9 },
        { trait_id: "rotenburo", evidence: "露天風呂が付く", confidence: 0.8 },
        { trait_id: "rotenburo", evidence: "露天風呂が付く", confidence: 0.8 },
      ]),
      dest,
      asked,
    );
    expect(r.accepted.map((j) => j.traitId)).toEqual(["rotenburo"]);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      "根拠が紹介文に無い（引用でない）",
      "根拠が無い",
      "confidence が 0〜1 の数でない",
      "confidence が 0.5 未満",
      "尋ねていない特徴",
      "重複",
    ]);
  });

  it("名前からの引用も通す。JSON でない応答は全部除く", () => {
    expect(parseResponse(res([{ trait_id: "quiet", evidence: "森の宿", confidence: 0.6 }]), dest, asked).accepted).toHaveLength(1);
    expect(parseResponse("分かりません", dest, asked)).toEqual({ accepted: [], rejected: [{ traitId: null, reason: "JSON として読めない" }] });
    expect(parseResponse('{"results": "x"}', dest, asked).rejected[0].reason).toBe("results が配列ではない");
  });
});

describe("agreement / sample / pickVerifySample", () => {
  it("一致率と、Haiku が付けた組のうち Sonnet も付けた数", () => {
    const pairs = [
      { destId: "a", traitId: "x", a: true, b: true },
      { destId: "a", traitId: "y", a: true, b: false },
      { destId: "b", traitId: "x", a: false, b: false },
      { destId: "b", traitId: "y", a: false, b: true },
    ];
    expect(agreement(pairs)).toEqual({ total: 4, agree: 2, rate: 0.5, aTrue: { total: 2, agree: 1 } });
    expect(agreement([]).rate).toBeNull();
  });

  it("sample は重複なしで n 個（乱数を固定すれば同じ）", () => {
    const rng = () => 0.3;
    const s = sample([1, 2, 3, 4, 5], 3, rng);
    expect(new Set(s).size).toBe(3);
    expect(sample([1, 2, 3, 4, 5], 3, rng)).toEqual(s);
    expect(sample([1, 2], 5)).toHaveLength(2);
  });

  it("標本は付いた組を半分まで、足りなければ付かなかった組で埋め、付かなかった組が足りなければ付いた組で埋める", () => {
    const mk = (pos: number, neg: number) => [
      ...Array.from({ length: pos }, (_, i) => ({ id: `p${i}`, a: true })),
      ...Array.from({ length: neg }, (_, i) => ({ id: `n${i}`, a: false })),
    ];
    const count = (xs: { a: boolean }[]) => [xs.filter((x) => x.a).length, xs.filter((x) => !x.a).length];
    expect(count(pickVerifySample(mk(100, 100), 50))).toEqual([25, 25]);
    expect(count(pickVerifySample(mk(3, 100), 50))).toEqual([3, 47]);
    expect(count(pickVerifySample(mk(100, 4), 50))).toEqual([46, 4]);
    expect(pickVerifySample(mk(2, 3), 50)).toHaveLength(5);
  });
});
