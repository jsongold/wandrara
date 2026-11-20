import { describe, expect, it } from "vitest";
import type { DestDetailView } from "./detail";
import { mapUrlOf, shareItemOf, shareText, type ShareText } from "./share-plan";

const base = { id: "d1", title: "森の宿", areaLabel: "箱根・仙石原", kindLabel: "宿", summary: "森の中の一棟貸し。", isDemo: false, photos: [], facts: [], accommodation: null, experience: null, nature: null, building: null, hotspring: null, village: null, location: { lat: 35.25, lng: 139.02 } } as DestDetailView;

const stay = {
  ...base,
  accommodation: {
    stay: { checkIn: "15:00", checkOut: "10:00" },
    priceTable: { unitLabel: "1 棟 1 泊・税込（円）", perLabel: "1 棟 1 泊", currency: "JPY", taxIncluded: true, rows: [{ roomLabel: "1 棟", guests: null, min: 25000, max: 25000, mealsLabels: [] }, { roomLabel: "1 棟", guests: null, min: 30000, max: 35000, mealsLabels: [] }], fees: [], children: [], officialUrl: null },
    access: { station: "箱根湯本駅", modeLabel: "バス", minutes: 30, shuttle: null, slopeOrStairs: null, needsCar: null, winterRestriction: null, route: null },
    bookingLinks: [{ label: "Airbnb", url: "https://airbnb.example/1", isOfficial: false }, { label: "公式", url: "https://official.example", isOfficial: true }, { label: "Airbnb", url: "https://airbnb.example/1", isOfficial: false }],
  },
} as unknown as DestDetailView;

const t: ShareText = { heading: (x) => `【${x}】`, role: { stay: "泊まる", activity: "過ごす" }, price: "料金", times: "時間", access: "行き方", unknown: "不明", map: "地図", book: "予約", more: "詳しく", footer: "— WANDRARA" };

describe("shareItemOf", () => {
  it("料金は一番安い〜高いと単位、行き方、チェックイン、地図、公式を先にしたリンク（重複なし）", () => {
    const it = shareItemOf(stay, "stay", "https://w.example/ja/d/x", "ja");
    expect(it.price).toBe("25,000〜35,000（1 棟 1 泊・税込（円））");
    expect(it.access).toBe("箱根湯本駅から バス 30分");
    expect(it.times).toBe("チェックイン 15:00／アウト 10:00");
    expect(it.mapUrl).toBe("https://www.google.com/maps/search/?api=1&query=35.25,139.02");
    expect(it.links).toEqual([{ label: "公式", url: "https://official.example" }, { label: "Airbnb", url: "https://airbnb.example/1" }]);
  });
  it("料金を出さない種類（自然など）は priced が false。値が無ければ null", () => {
    const it = shareItemOf({ ...base, kindLabel: "自然", location: null }, "activity", "u", "ja");
    expect(it).toMatchObject({ priced: false, price: null, access: null, mapUrl: null, links: [] });
  });
});

describe("shareText", () => {
  it("見出し・枠ごとのまとまり・足りない値は不明・最後に署名", () => {
    const items = [shareItemOf(stay, "stay", "https://w/1", "ja"), { ...shareItemOf({ ...stay, accommodation: null, experience: { priceTable: null } } as unknown as DestDetailView, "activity", "https://w/2", "ja"), title: "朝のカヌー", kindLabel: "体験" }];
    const text = shareText("箱根・温泉 1 泊 2 日", items, t);
    expect(text.startsWith("【箱根・温泉 1 泊 2 日】\n\n■ 泊まる：森の宿（宿・箱根・仙石原）")).toBe(true);
    expect(text).toContain("・料金 25,000〜35,000（1 棟 1 泊・税込（円））");
    expect(text).toContain("■ 過ごす：朝のカヌー（体験・箱根・仙石原）");
    expect(text).toContain("・料金 不明");
    expect(text).toContain("・予約（公式） https://official.example");
    expect(text).toContain("・予約 不明"); // 予約リンクの無い体験
    expect(text).toContain("・詳しく https://w/2");
    expect(text.endsWith("— WANDRARA")).toBe(true);
  });
  it("予約が要らない種類（自然など）は「予約 不明」を出さない", () => {
    const text = shareText("x", [shareItemOf({ ...base, kindLabel: "自然" }, "activity", "u", "ja")], t);
    expect(text).not.toContain("予約");
  });
  it("地図の URL", () => expect(mapUrlOf(null)).toBeNull());
});
