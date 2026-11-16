// テストと fixture 用の架空の日帰り温泉の details（提案の見本と同じ）
import type { HotspringDetails } from "./details.ts";

export const sampleHotspringDetails = (): HotspringDetails => ({
  baths: [
    { kind: "open_air", hot_spring: true, spring: "アルカリ性単純温泉", source: "natural_flow", gender: "separate" },
    { kind: "indoor", hot_spring: true, gender: "separate" },
    {
      kind: "private",
      hot_spring: true,
      gender: "private",
      fee: { amount: 2000, currency: "JPY" },
      reservation: { required: false, slot_minutes: 50 },
    },
  ],
  hours: {
    open: "10:00",
    close: "21:00",
    last_entry: "20:30",
    closed_weekdays: [4],
  },
  fees: [
    { audience: "adult", amount: 1000, currency: "JPY" },
    { audience: "child", amount: 500, currency: "JPY" },
    { amount: 2000, currency: "JPY", note: { ja: "貸切風呂 50 分", en: "Private bath, 50 min" } },
  ],
  amenities: {
    towel: "rental",
    towel_fee: { amount: 200, currency: "JPY" },
    rest_area: true,
    meal: true,
  },
  access: {
    station: { ja: "○○駅", en: "Example Station" },
    mode: "walk",
    minutes: 10,
    parking: { available: true, spaces: 30, paid: false },
  },
  cautions: [{ note: { ja: "タトゥーのある人は入れない", en: "Guests with tattoos cannot enter" } }],
  sources: [{ name: "公式サイト", url: "https://example.com/", type: "official", retrieved_at: "2026-11-16", fields: ["hours", "fees", "access"] }],
});
