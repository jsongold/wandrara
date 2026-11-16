import { describe, expect, it } from "vitest";
import { natureCore } from "../../db/schema/nature.ts";
import { KIND_LIST, PROTECTION_LIST } from "../vocab/nature.ts";
import { natureDetailsSchema } from "./details.ts";
import { sampleNatureDetails } from "./sample.ts";

const fail = (mutate: (d: ReturnType<typeof sampleNatureDetails>) => void) => {
  const d = sampleNatureDetails();
  mutate(d);
  const r = natureDetailsSchema.safeParse(d);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
};

describe("natureDetailsSchema", () => {
  it("架空の見本は通る・空も通る", () => {
    expect(natureDetailsSchema.safeParse(sampleNatureDetails()).success).toBe(true);
    expect(natureDetailsSchema.safeParse({}).success).toBe(true);
  });

  it("access は 1 つ。配列（旧い表の形）は弾く", () => {
    expect(natureDetailsSchema.safeParse({ access: [{ has_parking: true }] }).success).toBe(false);
    expect(natureDetailsSchema.safeParse({ hours_fees: [{ amount: 0 }] }).success).toBe(false);
  });

  it.each<[string, (d: ReturnType<typeof sampleNatureDetails>) => void, string]>([
    ["トレイルの key が重なる", (d) => (d.trails![1].key = "misaki"), "trails.1.key"],
    ["見頃の月が 13", (d) => (d.seasons![0].month_to = 13), "seasons.0.month_to"],
    ["見頃の月が 0", (d) => (d.seasons![0].month_from = 0), "seasons.0.month_from"],
    ["date_from > date_to", (d) => (d.restrictions![0].date_from = "2027-03-01"), "restrictions.0.date_to"],
    ["日付が実在しない", (d) => (d.restrictions![0].date_to = "2027-02-30"), "restrictions.0.date_to"],
    ["難しさが語彙に無い", (d) => ((d.trails![0] as { difficulty: string }).difficulty = "extreme"), "trails.0.difficulty"],
    ["規制の kind が語彙に無い", (d) => ((d.restrictions![0] as { kind: string }).kind = "flood"), "restrictions.0.kind"],
    ["行き方の mode が語彙に無い", (d) => ((d.access as { mode: string }).mode = "shuttle"), "access.mode"],
    ["営業時間が HH:MM でない", (d) => (d.hours = { open: "9時" }), "hours.open"],
    ["amount > amount_max", (d) => (d.fees = [{ amount: 500, amount_max: 100, currency: "JPY" }]), "fees.0.amount_max"],
    ["通貨が 3 文字でない", (d) => (d.fees![0].currency = "yen"), "fees.0.currency"],
  ])("%s", (_name, mutate, path) => {
    const issues = fail(mutate);
    expect(issues.some((i) => i.startsWith(path)), issues.join("\n")).toBe(true);
  });

  it("語彙の kind・protection は DB の check と同じ", () => {
    expect(KIND_LIST.map((t) => t.code).sort()).toEqual(Object.keys(natureCore.kindLabels).sort());
    expect(PROTECTION_LIST).toHaveLength(5);
  });
});
