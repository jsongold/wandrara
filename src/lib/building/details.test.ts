import { describe, expect, it } from "vitest";
import { buildingCore } from "../../db/schema/building.ts";
import { KIND_LIST } from "../vocab/building.ts";
import { buildingDetailsSchema } from "./details.ts";
import { sampleBuildingDetails } from "./sample.ts";

type D = ReturnType<typeof sampleBuildingDetails>;
const fail = (mutate: (d: D) => void) => {
  const d = sampleBuildingDetails();
  mutate(d);
  const r = buildingDetailsSchema.safeParse(d);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
};

describe("buildingDetailsSchema", () => {
  it("架空の見本は通る・空も通る", () => {
    expect(buildingDetailsSchema.safeParse(sampleBuildingDetails()).success).toBe(true);
    expect(buildingDetailsSchema.safeParse({}).success).toBe(true);
  });

  it("hours・access は 1 つ。配列（旧い表の形）は弾く", () => {
    expect(buildingDetailsSchema.safeParse({ hours: [{ open_time: "09:00" }] }).success).toBe(false);
    expect(buildingDetailsSchema.safeParse({ access: [{ has_parking: true }] }).success).toBe(false);
    expect(buildingDetailsSchema.safeParse({ fees: [{ amount: "500", currency: "JPY" }] }).success).toBe(false);
  });

  it.each<[string, (d: D) => void, string]>([
    ["開館が HH:MM でない", (d) => (d.hours!.open = "9時"), "hours.open"],
    ["休みの曜日が 8", (d) => (d.hours!.closed_weekdays = [8]), "hours.closed_weekdays"],
    ["amount > amount_max", (d) => (d.fees = [{ amount: 500, amount_max: 100, currency: "JPY" }]), "fees.0.amount_max"],
    ["料金が負", (d) => (d.fees![0].amount = -1), "fees.0.amount"],
    ["通貨が 3 文字でない", (d) => (d.fees![0].currency = "yen"), "fees.0.currency"],
    ["age_min > age_max", (d) => ((d.fees![1].age_min = 16), (d.fees![1].age_max = 6)), "fees.1.age_max"],
    ["対象が語彙に無い", (d) => ((d.fees![0] as { audience: string }).audience = "senior"), "fees.0.audience"],
    ["催しの日付が逆", (d) => (d.events![0].date_from = "2027-03-01"), "events.0.date_to"],
    ["催しの月が 13", (d) => (d.events![0].months = [13]), "events.0.months.0"],
    ["日付が実在しない", (d) => (d.events![0].date_to = "2027-02-30"), "events.0.date_to"],
    ["行き方の mode が語彙に無い", (d) => ((d.access as { mode: string }).mode = "shuttle"), "access.mode"],
  ])("%s", (_name, mutate, path) => {
    const issues = fail(mutate);
    expect(issues.some((i) => i.startsWith(path)), issues.join("\n")).toBe(true);
  });

  it("語彙の kind は DB の check と同じ", () => {
    expect(KIND_LIST.map((t) => t.code).sort()).toEqual(Object.keys(buildingCore.kindLabels).sort());
  });
});
