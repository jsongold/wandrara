import { describe, expect, it } from "vitest";
import { sampleHotspringDetails } from "./sample.ts";
import { toHotspringView, type HotspringViewInput } from "./view.ts";

const input = (over: Partial<HotspringViewInput> = {}): HotspringViewInput => ({ details: sampleHotspringDetails(), lat: 34.97, lng: 138.93, locale: "ja", ...over });
const view = (over: Partial<HotspringViewInput> = {}) => toHotspringView(input(over))!;

describe("toHotspringView", () => {
  it("details が無い・形が違う（旧い表の形）ときは null", () => {
    expect(toHotspringView(input({ details: null }))).toBeNull();
    expect(toHotspringView(input({ details: { baths: [{ bath_type: "indoor" }] } }))).toBeNull();
    expect(toHotspringView(input({ details: { hours: [{ opens_at: "10:00" }] } }))).toBeNull();
  });

  it("1 行：営業と大人の料金", () => {
    expect(view().summary).toEqual({ openText: "10:00〜21:00", adultFeeText: "1,000 円" });
    expect(view({ details: {} }).summary).toEqual({ openText: null, adultFeeText: null });
    // 大人の区分が無ければ出さない
    expect(view({ details: { fees: [{ amount: 500, currency: "JPY" }] } }).summary.adultFeeText).toBeNull();
  });

  it("風呂：種類・温泉・源泉の扱い・泉質・男女・料金・予約", () => {
    const b = view().baths;
    expect(b[0]).toEqual({
      kind: "open_air",
      label: "露天風呂",
      text: "温泉・源泉かけ流し",
      spring: "アルカリ性単純温泉",
      genderLabel: "男女別",
      feeText: null,
      reservationText: null,
      note: null,
    });
    expect(b[1]).toMatchObject({ label: "内風呂", text: "温泉", spring: null });
    expect(b[2]).toMatchObject({ label: "貸切風呂", genderLabel: "貸切", feeText: "50 分 2,000 円", reservationText: "当日受付" });
    // 何も分からない風呂は「あり」
    expect(view({ details: { baths: [{ kind: "sauna", reservation: { required: true } }] } }).baths[0]).toMatchObject({ label: "サウナ", text: "あり", reservationText: "予約が必要" });
  });

  it("料金：区分が無い料金はメモが見出し", () => {
    expect(view().fees).toEqual([
      { label: "大人", text: "1,000 円", free: false, audience: "adult", tax: null, note: null },
      { label: "子ども", text: "500 円", free: false, audience: "child", tax: null, note: null },
      { label: "貸切風呂 50 分", text: "2,000 円", free: false, audience: null, tax: null, note: null },
    ]);
  });

  it("時間・設備", () => {
    expect(view().hours).toEqual({ openText: "10:00〜21:00", closedDays: "木曜", closedNote: null, lastEntry: "20:30", note: null });
    expect(view().amenities).toEqual({ towelText: "貸し出し（200 円）", restArea: "あり", meal: "あり", note: null });
    expect(view({ details: { amenities: { towel: "none", rest_area: false } } }).amenities).toMatchObject({ towelText: "なし", restArea: "なし", meal: null });
    expect(view({ details: {} }).amenities).toBeNull();
  });

  it("温泉ではない風呂は明示し、不明と区別する", () => {
    const text = (hot_spring?: boolean) => view({ details: { baths: [{ kind: "indoor", hot_spring }] } }).baths[0].text;
    expect(text(false)).toBe("温泉ではない");
    expect(text(undefined)).toBe("あり");
    expect(view({ locale: "en", details: { baths: [{ kind: "indoor", hot_spring: false }] } }).baths[0].text).toBe("Not a hot spring");
  });

  it("タオルの料金だけでも出す", () => {
    expect(view({ details: { amenities: { towel_fee: { amount: 200, currency: "JPY" } } } }).amenities?.towelText).toBe("200 円");
  });

  it("公式サイトの URL を渡す", () => {
    expect(view({ officialUrl: "https://example.com/" }).officialUrl).toBe("https://example.com/");
    expect(view().officialUrl).toBeNull();
  });

  it("アクセスと地図の位置・注意点・出典", () => {
    const v = view();
    expect(v.access).toMatchObject({ how: "徒歩 10 分", parking: { text: "あり（無料・30 台）" } });
    expect(v.location).toEqual({ lat: 34.97, lng: 138.93 });
    expect(v.cautions).toEqual(["タトゥーのある人は入れない"]);
    expect(v.sources).toHaveLength(1);
  });

  it("en：英語の文", () => {
    const v = view({ locale: "en" });
    expect(v.baths[0]).toMatchObject({ label: "Open-air bath", text: "Hot spring, Free-flowing spring water", genderLabel: "Separate for men and women" });
    expect(v.baths[2]).toMatchObject({ feeText: "50 min ¥2,000", reservationText: "Walk-in" });
    expect(v.amenities).toMatchObject({ towelText: "Rental (¥200)", restArea: "Yes" });
    expect(v.fees[2].label).toBe("Private bath, 50 min");
  });
});
