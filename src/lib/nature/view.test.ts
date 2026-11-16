import { describe, expect, it } from "vitest";
import { sampleNatureDetails } from "./sample.ts";
import { toNatureView, type NatureViewInput } from "./view.ts";

const input = (over: Partial<NatureViewInput> = {}): NatureViewInput => ({ details: sampleNatureDetails(), lat: 34.9, lng: 139.1, locale: "ja", ...over });
const view = (over: Partial<NatureViewInput> = {}) => toNatureView(input(over))!;

describe("toNatureView", () => {
  it("details が無い・形が違う（旧い表の形）ときは null", () => {
    expect(toNatureView(input({ details: null }))).toBeNull();
    expect(toNatureView(input({ details: { access: [{ has_parking: true }] } }))).toBeNull();
    expect(toNatureView(input({ details: { trails: [{ key: "a", name: { ja: "a" } }, { key: "a", name: { ja: "b" } }] } }))).toBeNull();
  });

  it("1 行：見頃（最初の見頃の月）と入場", () => {
    expect(view().summary).toEqual({ seasonText: "4〜5 月", feeText: "入場無料" });
    const fee = { fees: [{ audience: "adult", amount: 300, amount_max: 500, currency: "JPY" }] };
    expect(view({ details: fee }).summary).toEqual({ seasonText: null, feeText: "入場 300〜500 円" });
    expect(view({ details: {} }).summary).toEqual({ seasonText: null, feeText: null });
  });

  it("見頃・時間・料金", () => {
    const v = view();
    expect(v.seasons).toEqual([
      { subject: "つつじ", months: "4〜5 月" },
      { subject: "夕日", months: "10〜2 月" },
    ]);
    expect(v.hours).toEqual({ alwaysOpen: true, text: "いつでも", closedNote: null });
    expect(v.fees).toEqual([{ audienceLabel: null, text: "無料", free: true, note: null }]);
    const d = {
      hours: { open: "09:00", close: "17:00", closed_note: { ja: "年末年始は休み" } },
      fees: [
        { audience: "adult", amount: 500, currency: "JPY" },
        { audience: "child", amount: 200, currency: "JPY", note: { ja: "小学生" } },
      ],
    };
    const w = view({ details: d });
    expect(w.hours).toEqual({ alwaysOpen: false, text: "09:00〜17:00", closedNote: "年末年始は休み" });
    expect(w.fees).toEqual([
      { audienceLabel: "大人", text: "500 円", free: false, note: null },
      { audienceLabel: "子ども", text: "200 円", free: false, note: "小学生" },
    ]);
  });

  it("アクセスと駐車場。地図の位置はコアの座標", () => {
    const v = view();
    expect(v.access).toEqual({
      station: "○○駅",
      modeLabel: "徒歩",
      minutes: 15,
      how: "徒歩 15 分",
      parking: { available: true, spaces: 80, paid: true, text: "あり（有料・80 台）" },
      route: "駅から海の方へ下る",
    });
    expect(v.location).toEqual({ lat: 34.9, lng: 139.1 });
    expect(view({ lat: null }).location).toBeNull();
    expect(view({ details: { access: { parking: { available: false } } } }).access).toMatchObject({ how: null, parking: { available: false, text: "なし" } });
    expect(view({ details: {} }).access).toBeNull();
    // 手段が無くても分は出す
    expect(view({ details: { access: { station: { ja: "○○駅" }, minutes: 10 } } }).access).toMatchObject({ how: "10 分" });
  });

  it("歩く道・規制・注意点・出典", () => {
    const v = view();
    expect(v.trails[0]).toEqual({
      key: "misaki",
      label: "岬めぐりコース",
      distanceKm: 3.2,
      elevationGainM: 120,
      difficulty: "moderate",
      difficultyLabel: "普通",
      durationMinutes: 90,
      summary: "3.2 km・90 分",
    });
    expect(v.restrictions).toEqual([
      { kind: "closure", kindLabel: "立入禁止", note: "岩場の一部", period: "2026-12-01〜2027-02-28", dateFrom: "2026-12-01", dateTo: "2027-02-28" },
    ]);
    expect(view({ details: { restrictions: [{ kind: "other", date_from: "2026-12-01" }] } }).restrictions[0]).toMatchObject({ note: null, period: "2026-12-01 から" });
    expect(v.cautions).toEqual(["波の高い日は岩場に下りない"]);
    expect(v.sources).toEqual([{ name: "市の観光サイト", url: "https://example.com/", typeLabel: "公式", retrievedAt: "2026-11-16", fields: [] }]);
  });

  it("欄が無ければ空", () => {
    const v = view({ details: {} });
    expect([v.seasons, v.hours, v.fees, v.access, v.trails, v.restrictions, v.cautions, v.sources]).toEqual([[], null, [], null, [], [], [], []]);
  });

  it("en：英語の表示名・文。無い言語は別の言語に落ちる", () => {
    const v = view({ locale: "en" });
    expect(v.summary).toEqual({ seasonText: "Apr–May", feeText: "Free entry" });
    expect(v.seasons[1]).toEqual({ subject: "Sunsets", months: "Oct–Feb" });
    expect(v.hours!.text).toBe("Open any time");
    expect(v.access).toMatchObject({ modeLabel: "Walk", how: "Walk, 15 min", parking: { text: "Yes (paid, 80 spaces)" }, station: "Example Station" });
    expect(v.trails[0]).toMatchObject({ difficultyLabel: "Moderate", summary: "3.2 km, 90 min" });
    expect(v.restrictions[0]).toMatchObject({ kindLabel: "Closed to entry", period: "2026-12-01 – 2027-02-28" });
    expect(view({ details: { cautions: [{ note: { ja: "日本語だけ" } }] }, locale: "en" }).cautions).toEqual(["日本語だけ"]);
  });
});
