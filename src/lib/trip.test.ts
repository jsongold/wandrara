import { describe, expect, it } from "vitest";
import { isEmptyTrip, monthsAhead, parseTrip, seasonKeywords, tripKeywords, tripLabel, tripQuery } from "./trip";

describe("trip", () => {
  it("URL を読み書きする。範囲外・知らないものは捨てる", () => {
    const t = parseTrip({ p: "2", m: "11", o: "pets,nope,kids,pets" });
    expect(t).toEqual({ people: 2, month: 11, options: ["pets", "kids"] });
    expect(tripQuery(t)).toEqual({ p: "2", m: "11", o: "pets,kids" });
    expect(parseTrip({ p: "0", m: "13", o: "" })).toEqual({ people: null, month: null, options: [] });
    expect(isEmptyTrip(parseTrip({}))).toBe(true);
    expect(tripQuery(parseTrip({}))).toEqual({});
  });
  it("そのほかと季節を条件のキーワードにする", () => {
    expect(tripKeywords({ people: 2, month: 11, options: ["pets", "barrier_free"] })).toEqual(["dogs_ok", "wheelchair", "autumn_leaves"]);
    expect(seasonKeywords(1)).toEqual(["snow_scenery"]);
    expect(seasonKeywords(5)).toEqual([]);
  });
  it("今の月から先の月、短い名前", () => {
    expect(monthsAhead(new Date(2026, 10, 20), 4)).toEqual([11, 12, 1, 2]);
    const words = { people: (n: number) => `${n}人`, month: (m: number) => `${m}月`, option: { pets: "犬連れ", barrier_free: "バリアフリー", kids: "子ども連れ", solo: "ひとり" }, sep: "・" };
    expect(tripLabel({ people: 2, month: 11, options: ["pets"] }, words)).toBe("2人・11月・犬連れ");
  });
});
