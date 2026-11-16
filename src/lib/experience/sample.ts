// テストと fixture 用の架空の体験の details（提案の見本と同じ）
import type { ExperienceDetails } from "./details.ts";

export const sampleExperienceDetails = (): ExperienceDetails => ({
  courses: [
    {
      key: "tasting",
      name: { ja: "見学と試飲", en: "Tour and tasting" },
      description: { ja: "畑と醸造所の見学、試飲 3 種", en: "Vineyard and cellar tour, 3 wines" },
      duration_minutes: 90,
      people_min: 1,
      people_max: 20,
      age_min: 6,
      languages: ["ja", "en"],
    },
    { key: "private", name: { ja: "貸切ツアー", en: "Private tour" }, duration_minutes: 120, people_min: 2, people_max: 8, languages: ["ja"] },
  ],
  prices: {
    items: [
      { course: "tasting", per: "person", audience: "adult", amount: 3500, currency: "JPY", tax_included: true },
      { course: "tasting", per: "person", audience: "child", age_min: 6, age_max: 12, amount: 2500, currency: "JPY", tax_included: true },
      { course: "tasting", per: "person", amount: 2500, amount_max: 3500, currency: "JPY", tax_included: true },
      { course: "private", per: "group", people_min: 2, people_max: 8, amount: 20000, currency: "JPY", tax_included: true },
    ],
  },
  schedules: [
    {
      months_from: 3,
      months_to: 11,
      weekdays: [5, 6, 7],
      start_times: ["10:00", "14:00"],
      rain_policy: { ja: "屋内の見学に変える", en: "Moves indoors" },
    },
  ],
  locations: [
    {
      kind: "meeting",
      lat: 34.9,
      lng: 138.95,
      geo_precision: "exact",
      address: { ja: "伊豆市○○ 1-2", en: "1-2 Example, Izu" },
      note: { ja: "ワイナリーの受付", en: "Winery reception" },
    },
  ],
  inclusions: [
    { kind: "included", item: { ja: "ガイド", en: "Guide" } },
    { kind: "included", item: { ja: "試飲 5 種", en: "5 tastings" } },
    { kind: "excluded", item: { ja: "交通", en: "Transport" } },
    { kind: "bring", item: { ja: "歩きやすい靴", en: "Comfortable shoes" } },
  ],
  cautions: [{ note: { ja: "運転する人は試飲できません", en: "Drivers cannot taste" } }],
  booking_links: [{ label: "公式サイトで予約", url: "https://example.com/book", is_official: true }],
  sources: [{ name: "公式サイト", url: "https://example.com/", type: "official", retrieved_at: "2026-11-16", fields: ["prices", "courses"] }],
});
