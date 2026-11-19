import { describe, expect, it } from "vitest";
import { sampleExperienceDetails } from "./sample.ts";
import { toExperienceView, type ExperienceViewInput } from "./view.ts";

const input = (over: Partial<ExperienceViewInput> = {}): ExperienceViewInput => ({
  details: sampleExperienceDetails(),
  durationMinutes: 90,
  reservationRequired: true,
  officialUrl: "https://example.com/",
  locale: "ja",
  ...over,
});
const view = (over: Partial<ExperienceViewInput> = {}) => toExperienceView(input(over))!;

describe("toExperienceView", () => {
  it("details が無い・形が違う（旧い表の形）ときは null", () => {
    expect(toExperienceView(input({ details: null }))).toBeNull();
    expect(toExperienceView(input({ details: undefined }))).toBeNull();
    expect(toExperienceView(input({ details: { prices: [{ amount: 1, currency: "JPY" }] } }))).toBeNull();
    expect(toExperienceView(input({ details: { courses: [{ key: "a", name: { ja: "a" } }, { key: "a", name: { ja: "b" } }] } }))).toBeNull();
  });

  it("所要・予約はコアの列から", () => {
    expect(view().summary).toEqual({ durationMinutes: 90, reservationRequired: true });
    expect(view({ durationMinutes: null, reservationRequired: null }).summary).toEqual({ durationMinutes: null, reservationRequired: null });
  });

  it("料金の表はコースごとに 1 行。最小〜最大・人数・単位・開くと出る大人・子どもの文", () => {
    const t = view().priceTable!;
    expect(t.currency).toBe("JPY");
    expect(t.taxIncluded).toBe(true);
    expect(t.unitLabel).toBe("税込（円）");
    expect(t.officialUrl).toBe("https://example.com/");
    expect(t.rows).toEqual([
      {
        courseLabel: "見学と試飲",
        people: "1〜20",
        min: 2500,
        max: 3500,
        currency: "JPY",
        perLabel: "1 名",
        notes: ["大人 3,500 円", "子ども（6〜12 歳） 2,500 円"],
      },
      { courseLabel: "貸切ツアー", people: "2〜8", min: 20000, max: 20000, currency: "JPY", perLabel: "1 グループ", notes: [] },
    ]);
  });

  it("料金が無ければ priceTable は null。course の無い料金は「全コース」。単位が違えば行が分かれる", () => {
    expect(view({ details: { cautions: [{ note: { ja: "x" } }] } }).priceTable).toBeNull();
    const d = sampleExperienceDetails();
    d.prices = {
      items: [
        { per: "person", amount: 1000, currency: "JPY" },
        { per: "session", amount: 5000, currency: "JPY" },
      ],
    };
    const rows = view({ details: d }).priceTable!.rows;
    expect(rows.map((r) => [r.courseLabel, r.perLabel, r.min])).toEqual([
      ["全コース", "1 名", 1000],
      ["全コース", "1 回", 5000],
    ]);
    expect(view({ details: { prices: d.prices } }).priceTable!.rows[0].courseLabel).toBe("料金（参考）");
    expect(view({ details: { prices: d.prices } }).priceTable!.taxIncluded).toBeNull();
  });

  it("人数だけ違う料金は「人数 … 名」の文になる", () => {
    const d = sampleExperienceDetails();
    d.prices = {
      items: [
        { course: "private", per: "group", people_min: 2, people_max: 4, amount: 15000, currency: "JPY" },
        { course: "private", per: "group", people_min: 5, people_max: 8, amount: 20000, currency: "JPY" },
      ],
    };
    const [row] = view({ details: d }).priceTable!.rows;
    expect([row.min, row.max, row.people]).toEqual([15000, 20000, "2〜8"]);
    expect(row.notes).toEqual(["人数 2〜4 名 15,000 円", "人数 5〜8 名 20,000 円"]);
  });

  it("コース", () => {
    expect(view().courses[0]).toEqual({
      key: "tasting",
      label: "見学と試飲",
      description: "畑と醸造所の見学、試飲 3 種",
      durationMinutes: 90,
      durationText: "90 分",
      people: "1〜20",
      ageText: "6 歳から",
      languages: ["日本語", "英語"],
    });
    expect(view().courses[1]).toMatchObject({ description: null, ageText: null, languages: ["日本語"] });
  });

  it("開催：月・曜日・時間・雨の日", () => {
    expect(view().schedules).toEqual([{ months: "3〜11 月", weekdays: "金・土・日", times: "10:00 / 14:00", endTime: null, rainPolicy: "屋内の見学に変える" }]);
    const d = { schedules: [{ months_from: 5, months_to: 5, weekdays: [1, 2, 3, 4, 5, 6, 7], end_time: "17:00" }] };
    expect(view({ details: d }).schedules).toEqual([{ months: "5 月", weekdays: "毎日", times: null, endTime: "17:00", rainPolicy: null }]);
  });

  it("場所・含まれるもの（含む・含まない・持ち物の順）・注意点・予約・出典", () => {
    const v = view();
    expect(v.locations).toEqual([{ kind: "meeting", kindLabel: "集合場所", label: "ワイナリーの受付", address: "伊豆市○○ 1-2", lat: 34.9, lng: 138.95, geoPrecision: "exact" }]);
    expect(v.inclusions).toEqual([
      { kind: "included", label: "含むもの", items: ["ガイド", "試飲 5 種"] },
      { kind: "excluded", label: "含まないもの", items: ["交通"] },
      { kind: "bring", label: "持ち物", items: ["歩きやすい靴"] },
    ]);
    expect(v.cautions).toEqual(["運転する人は試飲できません"]);
    expect(v.bookingLinks).toEqual([{ label: "公式サイトで予約", url: "https://example.com/book", isOfficial: true }]);
    expect(v.sources).toEqual([{ name: "公式サイト", url: "https://example.com/", typeLabel: "公式", retrievedAt: "2026-11-16", fields: ["料金", "コース"] }]);
  });

  it("欄が無ければ空の配列", () => {
    const v = view({ details: {} });
    expect([v.priceTable, v.courses, v.schedules, v.locations, v.inclusions, v.cautions, v.bookingLinks, v.sources]).toEqual([null, [], [], [], [], [], [], []]);
  });

  it("en：英語の表示名・文。無い言語は出さない", () => {
    const v = view({ locale: "en" });
    expect(v.priceTable!.unitLabel).toBe("Tax incl. (¥)");
    expect(v.priceTable!.rows[0]).toMatchObject({ courseLabel: "Tour and tasting", perLabel: "per person", notes: ["Adults ¥3,500", "Children (ages 6–12) ¥2,500"] });
    expect(v.courses[0]).toMatchObject({ durationText: "90 min", ageText: "Age 6+", languages: ["Japanese", "English"] });
    expect(v.schedules[0]).toMatchObject({ months: "Mar–Nov", weekdays: "Fri, Sat, Sun", rainPolicy: "Moves indoors" });
    expect(v.locations[0]).toMatchObject({ kindLabel: "Meeting point", label: "Winery reception", address: "1-2 Example, Izu" });
    expect(v.inclusions.map((g) => g.label)).toEqual(["Included", "Not included", "What to bring"]);
    const ja = { courses: [{ key: "a", name: { ja: "日本語だけ" } }] };
    // 英語の名前が無ければ、日本語ではなくコースの key を出す（今までの名前が無いときの扱い）
    expect(view({ details: ja, locale: "en" }).courses[0].label).toBe("a");
  });
});
