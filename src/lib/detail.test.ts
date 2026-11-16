import { describe, expect, it } from "vitest";
import { accommodationCore } from "../db/schema/accommodation";
import { experienceCore } from "../db/schema/experience";
import { buildFacts, columnMap, formatValue } from "./detail";

describe("formatValue", () => {
  it("null は null、boolean は あり / なし、時刻は秒を落とす", () => {
    expect(formatValue(null, "ja")).toBeNull();
    expect(formatValue(true, "ja")).toBe("あり");
    expect(formatValue(true, "en")).toBe("Yes");
    expect(formatValue(false, "ja")).toBe("なし");
    expect(formatValue("15:00:00", "ja")).toBe("15:00");
    expect(formatValue(0, "ja")).toBe("0");
  });
  it("localized は locale で解決し、無ければ別の言語", () => {
    expect(formatValue({ ja: "朝食つき", en: "Breakfast" }, "en")).toBe("Breakfast");
    expect(formatValue({ ja: "朝食つき" }, "en")).toBe("朝食つき");
  });
  it("kind は kindLabels で日本語にする", () => {
    expect(formatValue("private_rental", "ja", { private_rental: "一棟貸し" })).toBe("一棟貸し");
  });
});

describe("columnMap", () => {
  it("TS のプロパティ名を DB の列名（snake_case）に引き当てる", () => {
    const map = columnMap(accommodationCore.table, { checkIn: "チェックイン", nope: "無い列" });
    expect(map).toEqual([{ prop: "checkIn", name: "check_in", label: "チェックイン" }]);
  });
});

describe("buildFacts", () => {
  it("null の列は出さず、kind は日本語、詳細は 1 件 1 行", () => {
    const facts = buildFacts(
      experienceCore,
      { kind: "tour", duration_minutes: null, reservation_required: true },
      [{ key: "courses", rows: [{ id: "c1", name: "港めぐり", max_people: 8, min_age: null }] }],
      "ja",
    );
    expect(facts.map((f) => [f.label, f.value])).toEqual([
      ["種類", "ツアー"],
      ["要予約", "あり"],
      ["コース", "港めぐり"],
    ]);
    expect(facts[2].detail).toBe("名前：港めぐり ／ 最大人数：8");
  });
  it("詳細の表の無いコア（宿）はコアの列だけ", () => {
    const facts = buildFacts(accommodationCore, { kind: "private_rental", check_in: null, check_out: "10:00:00" }, [], "ja");
    expect(facts.map((f) => [f.label, f.value])).toEqual([
      ["種類", "一棟貸し"],
      ["チェックアウト", "10:00"],
    ]);
  });
});
