import { describe, expect, it } from "vitest";
import { fc, type Feature } from "./parts.ts";
import { expandParts, seedSql } from "./seed-parts.ts";

const f = (KEY_CODE: string, S_NAME: string, S_AREA: string): Feature => ({ type: "Feature", properties: { KEY_CODE, S_NAME, S_AREA }, geometry: null });
const estat = { "22222": fc([f("222220110", "大沢", "011000"), f("222220530", "土肥", "053000"), f("222220790", "冷川", "079000"), f("222220791", "冷川", "079100")]) };

describe("expandParts", () => {
  it("コード範囲と名前を KEY_CODE 1 行ずつに展開し、n03 はそのまま", () => {
    const out = expandParts(
      { shuzenji: [{ estat: "22222", codeRange: [11, 52] }], nakaizu: [{ estat: "22222", names: ["冷川"] }], ito: [{ n03: "22208" }] },
      estat,
    );
    expect(out.get("shuzenji")).toEqual([{ source: "estat", version: "estat-2020", code: "222220110" }]);
    expect(out.get("nakaizu")?.map((r) => r.code)).toEqual(["222220790", "222220791"]);
    expect(out.get("ito")).toEqual([{ source: "n03", version: "N03-2024", code: "22208" }]);
  });
  it("見つからない定義と、2 つのエリアに入るコードは失敗", () => {
    expect(() => expandParts({ x: [{ estat: "22222", names: ["無い"] }] }, estat)).toThrow(/見つかりません/);
    expect(() => expandParts({ a: [{ n03: "1" }], b: [{ n03: "1" }] }, estat)).toThrow(/2 つのエリア/);
  });
  it("SQL に材料と点の位置が入る", () => {
    const sql = seedSql(new Map([["ito", [{ source: "n03", version: "N03-2024", code: "22208" }]]]), { owakudani: [139.02, 35.24] });
    expect(sql).toContain("('ito', 'n03', 'N03-2024', '22208')");
    expect(sql).toContain("update public.regions set lat = 35.24, lng = 139.02 where id = 'owakudani';");
  });
});
