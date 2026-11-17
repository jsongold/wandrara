import { describe, expect, it } from "vitest";
import { accommodationCore } from "../db/schema/accommodation";
import { tableDetailsCore } from "./ingest/test-fixtures";
import { buildFacts, columnMap, formatValue, placeOf } from "./detail";

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
      tableDetailsCore,
      { kind: "museum", official_url: null },
      [{ key: "fees", rows: [{ id: "f1", amount: 500, currency: "JPY", note: null }] }],
      "ja",
    );
    expect(facts.map((f) => [f.label, f.value])).toEqual([
      ["種類", "資料館"],
      ["料金", "500"],
    ]);
  });
  it("詳細の表の無いコア（宿）はコアの列だけ", () => {
    const facts = buildFacts(accommodationCore, { kind: "private_rental", check_in: null, check_out: "10:00:00" }, [], "ja");
    expect(facts.map((f) => [f.label, f.value])).toEqual([
      ["種類", "一棟貸し"],
      ["チェックアウト", "10:00"],
    ]);
  });
});

describe("placeOf", () => {
  it("緯度経度が両方とも数なら点にする", () => {
    expect(placeOf({ lat: 35.1, lng: 139.2 })).toEqual({ lat: 35.1, lng: 139.2 });
  });
  it("行が無い・片方でも null なら地図を出さない", () => {
    expect(placeOf(null)).toBeNull();
    expect(placeOf({ lat: 35.1, lng: null })).toBeNull();
    expect(placeOf({ lat: null, lng: null })).toBeNull();
  });
});
