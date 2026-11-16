// テストと fixture 用の架空のまちの details（提案の見本と同じ）
import type { VillageDetails } from "./details.ts";

export const sampleVillageDetails = (): VillageDetails => ({
  walks: [
    {
      key: "bamboo",
      name: { ja: "竹林と寺めぐり", en: "Bamboo grove and temples" },
      area: { ja: "駅前のバス停から寺まで", en: "From the bus stop by the station to the temple" },
      duration_minutes: 60,
      distance_km: 1.5,
      note: { ja: "坂が少しある", en: "A few slopes" },
    },
  ],
  shop_hours: { open: "10:00", close: "17:00", note: { ja: "水曜に休む店が多い", en: "Many shops close on Wednesdays" } },
  events: [{ name: { ja: "もみじ祭り", en: "Autumn leaves festival" }, months: [11], note: { ja: "夜のライトアップ", en: "Evening illumination" } }],
  access: {
    station: { ja: "○○駅", en: "Example Station" },
    mode: "bus",
    minutes: 10,
    parking: { available: true, spaces: 200, paid: true },
  },
  cautions: [{ note: { ja: "夕方以降は店の多くが閉まる", en: "Most shops close in the evening" } }],
  sources: [{ name: "公式サイト", url: "https://example.com/", type: "official", retrieved_at: "2026-11-16", fields: ["walks", "access"] }],
});
