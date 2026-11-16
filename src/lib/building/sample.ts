// テストと fixture 用の架空の建物の details（提案の見本と同じ）
import type { BuildingDetails } from "./details.ts";

export const sampleBuildingDetails = (): BuildingDetails => ({
  hours: {
    open: "09:00",
    close: "17:00",
    last_entry: "16:30",
    closed_weekdays: [3],
    closed_note: { ja: "年末年始（12/29〜1/1）", en: "New Year holidays (Dec 29 - Jan 1)" },
  },
  fees: [
    { audience: "adult", amount: 1500, currency: "JPY" },
    { audience: "child", age_min: 6, age_max: 15, amount: 700, currency: "JPY", note: { ja: "小・中学生", en: "Elementary and junior high" } },
    { label: { ja: "団体", en: "Group" }, amount: 1200, currency: "JPY", note: { ja: "20 名以上・大人", en: "20 or more, adults" } },
  ],
  events: [
    {
      name: { ja: "ガラスの冬展", en: "Winter glass exhibition" },
      date_from: "2026-12-01",
      date_to: "2027-02-28",
      note: { ja: "冬の器 120 点", en: "120 winter vessels" },
    },
  ],
  access: {
    station: { ja: "○○駅", en: "Example Station" },
    mode: "bus",
    minutes: 20,
    parking: { available: true, spaces: 100, paid: false },
    route: { ja: "バス停「美術館前」すぐ", en: "Right by the Museum-mae bus stop" },
  },
  cautions: [{ note: { ja: "館内は撮影できない部屋がある", en: "Photography is not allowed in some rooms" } }],
  sources: [{ name: "公式サイト", url: "https://example.com/", type: "official", retrieved_at: "2026-11-16", fields: ["hours", "fees", "access"] }],
});
