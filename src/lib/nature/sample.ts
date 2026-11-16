// テストと fixture 用の架空の自然の details（提案の見本と同じ）
import type { NatureDetails } from "./details.ts";

export const sampleNatureDetails = (): NatureDetails => ({
  seasons: [
    { subject: { ja: "つつじ", en: "Azaleas" }, month_from: 4, month_to: 5 },
    { subject: { ja: "夕日", en: "Sunsets" }, month_from: 10, month_to: 2 },
  ],
  hours: { always_open: true },
  fees: [{ amount: 0, currency: "JPY" }],
  access: {
    station: { ja: "○○駅", en: "Example Station" },
    mode: "walk",
    minutes: 15,
    parking: { available: true, spaces: 80, paid: true },
    route: { ja: "駅から海の方へ下る", en: "Head down toward the sea" },
  },
  trails: [
    { key: "misaki", name: { ja: "岬めぐりコース", en: "Cape loop" }, distance_km: 3.2, elevation_gain_m: 120, difficulty: "moderate", duration_minutes: 90 },
    { key: "bridge", name: { ja: "吊り橋まで", en: "To the suspension bridge" }, distance_km: 0.8, elevation_gain_m: 30, difficulty: "easy", duration_minutes: 20 },
  ],
  restrictions: [{ kind: "closure", note: { ja: "岩場の一部", en: "Part of the rocks" }, date_from: "2026-12-01", date_to: "2027-02-28" }],
  cautions: [{ note: { ja: "波の高い日は岩場に下りない", en: "Stay off the rocks on rough days" } }],
  sources: [{ name: "市の観光サイト", url: "https://example.com/", type: "official", retrieved_at: "2026-11-16" }],
});
