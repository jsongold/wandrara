import { describe, expect, it } from "vitest";
import { experienceDetailsSchema } from "./details.ts";
import { sampleExperienceDetails } from "./sample.ts";

// 直したあとの details が失敗するか。失敗した path と message を返す
const fail = (mutate: (d: ReturnType<typeof sampleExperienceDetails>) => void) => {
  const d = sampleExperienceDetails();
  mutate(d);
  const r = experienceDetailsSchema.safeParse(d);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
};

describe("experienceDetailsSchema", () => {
  it("架空の見本は通る・空も通る", () => {
    expect(experienceDetailsSchema.safeParse(sampleExperienceDetails()).success).toBe(true);
    expect(experienceDetailsSchema.safeParse({}).success).toBe(true);
  });

  it("知らない欄・旧い表の形は弾く", () => {
    expect(experienceDetailsSchema.safeParse({ foo: 1 }).success).toBe(false);
    expect(experienceDetailsSchema.safeParse({ prices: [{ unit: "per_person", amount: 1, currency: "JPY" }] }).success).toBe(false);
    expect(experienceDetailsSchema.safeParse({ courses: [{ name: { ja: "x" }, min_people: 1 }] }).success).toBe(false);
  });

  it.each<[string, (d: ReturnType<typeof sampleExperienceDetails>) => void, string]>([
    ["コースの key が重なる", (d) => (d.courses![1].key = "tasting"), "courses.1.key"],
    ["料金の course が無い", (d) => (d.prices!.items[0].course = "nope"), "prices.items.0.course"],
    ["people_min > people_max（コース）", (d) => (d.courses![0].people_min = 30), "courses.0.people_max"],
    ["people_min > people_max（料金）", (d) => ((d.prices!.items[3].people_min = 9), (d.prices!.items[3].people_max = 2)), "prices.items.3.people_max"],
    ["age_min > age_max", (d) => ((d.prices!.items[1].age_min = 13), (d.prices!.items[1].age_max = 6)), "prices.items.1.age_max"],
    ["amount > amount_max", (d) => (d.prices!.items[2].amount = 9999), "prices.items.2.amount_max"],
    ["料金の per が語彙に無い", (d) => ((d.prices!.items[0] as { per: string }).per = "per_person"), "prices.items.0.per"],
    ["月が 13", (d) => (d.schedules![0].months_to = 13), "schedules.0.months_to"],
    ["月が 0", (d) => (d.schedules![0].months_from = 0), "schedules.0.months_from"],
    ["曜日が 8", (d) => (d.schedules![0].weekdays = [8]), "schedules.0.weekdays.0"],
    ["曜日が重なる", (d) => (d.schedules![0].weekdays = [5, 5]), "schedules.0.weekdays"],
    ["時刻が HH:MM でない", (d) => (d.schedules![0].start_times = ["10時"]), "schedules.0.start_times.0"],
    ["end_time が範囲外", (d) => (d.schedules![0].end_time = "24:00"), "schedules.0.end_time"],
    ["lat が文字", (d) => ((d.locations![0] as { lat: unknown }).lat = "35"), "locations.0.lat"],
    ["lng が範囲外", (d) => (d.locations![0].lng = 200), "locations.0.lng"],
    ["場所の kind が語彙に無い", (d) => ((d.locations![0] as { kind: string }).kind = "start"), "locations.0.kind"],
    ["URL が http(s) でない", (d) => (d.booking_links![0].url = "ftp://example.com"), "booking_links.0.url"],
  ])("%s", (_name, mutate, path) => {
    const issues = fail(mutate);
    expect(issues.some((i) => i.startsWith(path)), issues.join("\n")).toBe(true);
  });
});
