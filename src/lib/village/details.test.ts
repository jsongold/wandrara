import { describe, expect, it } from "vitest";
import { villageCore } from "../../db/schema/village.ts";
import { KIND_LIST } from "../vocab/village.ts";
import { villageDetailsSchema } from "./details.ts";
import { sampleVillageDetails } from "./sample.ts";

type D = ReturnType<typeof sampleVillageDetails>;
const fail = (mutate: (d: D) => void) => {
  const d = sampleVillageDetails();
  mutate(d);
  const r = villageDetailsSchema.safeParse(d);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
};

describe("villageDetailsSchema", () => {
  it("架空の見本は通る・空も通る", () => {
    expect(villageDetailsSchema.safeParse(sampleVillageDetails()).success).toBe(true);
    expect(villageDetailsSchema.safeParse({}).success).toBe(true);
  });

  it("access・shop_hours は 1 つ。配列（旧い表の形）は弾く", () => {
    expect(villageDetailsSchema.safeParse({ access: [{ note: "駅から徒歩" }] }).success).toBe(false);
    expect(villageDetailsSchema.safeParse({ shop_hours: [{ opens_at: "10:00" }] }).success).toBe(false);
    expect(villageDetailsSchema.safeParse({ walks: [{ area: { ja: "x" }, duration_min: 30 }] }).success).toBe(false);
  });

  it.each<[string, (d: D) => void, string]>([
    ["歩き方の key が重なる", (d) => d.walks!.push({ ...d.walks![0] }), "walks.1.key"],
    ["歩き方の key が大文字", (d) => (d.walks![0].key = "Bamboo"), "walks.0.key"],
    ["所要時間が 0 分", (d) => (d.walks![0].duration_minutes = 0), "walks.0.duration_minutes"],
    ["距離が負", (d) => (d.walks![0].distance_km = -1), "walks.0.distance_km"],
    ["店の時間が HH:MM でない", (d) => (d.shop_hours!.open = "10時"), "shop_hours.open"],
    ["催しの月が 0", (d) => (d.events![0].months = [0]), "events.0.months.0"],
    ["行き方の mode が語彙に無い", (d) => ((d.access as { mode: string }).mode = "shuttle"), "access.mode"],
  ])("%s", (_name, mutate, path) => {
    const issues = fail(mutate);
    expect(issues.some((i) => i.startsWith(path)), issues.join("\n")).toBe(true);
  });

  it("語彙の kind は DB の check と同じ", () => {
    expect(KIND_LIST.map((t) => t.code).sort()).toEqual(Object.keys(villageCore.kindLabels).sort());
  });
});
