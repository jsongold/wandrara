import { describe, expect, it } from "vitest";
import { sampleBuildingDetails } from "./sample.ts";
import { toBuildingView, type BuildingViewInput } from "./view.ts";

const input = (over: Partial<BuildingViewInput> = {}): BuildingViewInput => ({ details: sampleBuildingDetails(), lat: 35.2, lng: 139.0, locale: "ja", ...over });
const view = (over: Partial<BuildingViewInput> = {}) => toBuildingView(input(over))!;

describe("toBuildingView", () => {
  it("details が無い・形が違う（旧い表の形）ときは null", () => {
    expect(toBuildingView(input({ details: null }))).toBeNull();
    expect(toBuildingView(input({ details: { hours: [{ open_time: "09:00" }] } }))).toBeNull();
    expect(toBuildingView(input({ details: { fees: [{ amount: 1, currency: "JPY", amount_max: 0 }] } }))).toBeNull();
  });

  it("1 行：開館と入館（大人の料金）", () => {
    expect(view().summary).toEqual({ openText: "09:00〜17:00", feeText: "1,500 円" });
    expect(view({ details: { fees: [{ amount: 0, currency: "JPY" }] } }).summary).toEqual({ openText: null, feeText: "無料" });
    expect(view({ details: {} }).summary).toEqual({ openText: null, feeText: null });
  });

  it("時間：開館・休み・そのほかの休み・入館の締め切り", () => {
    expect(view().hours).toEqual({
      openText: "09:00〜17:00",
      closedDays: "水曜",
      closedNote: "年末年始（12/29〜1/1）",
      lastEntry: "16:30",
      note: null,
    });
    expect(view({ details: { hours: { closed_weekdays: [4, 3, 3] } } }).hours).toMatchObject({ openText: null, closedDays: "水・木曜" });
  });

  it("料金：区分・年齢・名前", () => {
    expect(view().fees).toEqual([
      { label: "大人", text: "1,500 円", free: false, audience: "adult", tax: null, note: null },
      { label: "子ども（6〜15 歳）", text: "700 円", free: false, audience: "child", tax: null, note: "小・中学生" },
      { label: "団体", text: "1,200 円", free: false, audience: null, tax: null, note: "20 名以上・大人" },
    ]);
    const f = view({ details: { fees: [{ amount: 300, currency: "JPY", tax_included: true }, { amount: 0, currency: "JPY", age_max: 5 }] } }).fees;
    expect(f).toMatchObject([{ label: "入館料", tax: "税込" }, { label: "5 歳以下", text: "無料", free: true }]);
  });

  it("料金：名前と区分・年齢の両方を見出しに出す", () => {
    const f = view({ details: { fees: [{ label: { ja: "団体" }, audience: "child", age_min: 6, age_max: 15, amount: 700, currency: "JPY" }] } }).fees;
    expect(f[0].label).toBe("団体・子ども（6〜15 歳）");
  });

  it("公式サイトの URL を渡す", () => {
    expect(view({ officialUrl: "https://example.com/" }).officialUrl).toBe("https://example.com/");
    expect(view().officialUrl).toBeNull();
  });

  it("催し：期間・月・内容", () => {
    expect(view().events).toEqual([{ name: "ガラスの冬展", when: "2026-12-01〜2027-02-28", note: "冬の器 120 点" }]);
    expect(view({ details: { events: [{ name: { ja: "祭り" }, months: [5, 4] }] } }).events).toEqual([{ name: "祭り", when: "4 月・5 月", note: null }]);
  });

  it("アクセスと地図の位置・注意点・予約・出典", () => {
    const v = view();
    expect(v.access).toMatchObject({ station: "○○駅", how: "バス 20 分", parking: { text: "あり（無料・100 台）" }, route: "バス停「美術館前」すぐ" });
    expect(v.location).toEqual({ lat: 35.2, lng: 139 });
    expect(view({ lng: null }).location).toBeNull();
    expect(v.cautions).toEqual(["館内は撮影できない部屋がある"]);
    expect(v.sources[0]).toMatchObject({ name: "公式サイト", typeLabel: "公式", retrievedAt: "2026-11-16" });
    expect(view({ details: { booking_links: [{ label: "予約", url: "https://example.com/b", is_official: true }] } }).bookingLinks).toEqual([
      { label: "予約", url: "https://example.com/b", isOfficial: true },
    ]);
  });

  it("欄が無ければ空", () => {
    const v = view({ details: {} });
    expect([v.hours, v.fees, v.events, v.access, v.cautions, v.bookingLinks, v.sources]).toEqual([null, [], [], null, [], [], []]);
  });

  it("en：英語の文。無い言語は出さない", () => {
    const v = view({ locale: "en" });
    expect(v.hours).toMatchObject({ openText: "09:00–17:00", closedDays: "Wed", closedNote: "New Year holidays (Dec 29 - Jan 1)" });
    expect(v.fees[1]).toMatchObject({ label: "Children (ages 6–15)", text: "¥700" });
    expect(v.events[0]).toMatchObject({ name: "Winter glass exhibition" });
    expect(v.access).toMatchObject({ how: "Bus, 20 min" });
    expect(view({ details: { cautions: [{ note: { ja: "日本語だけ" } }] }, locale: "en" }).cautions).toEqual([]);
  });
});
