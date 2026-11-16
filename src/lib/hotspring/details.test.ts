import { describe, expect, it } from "vitest";
import { hotspringCore } from "../../db/schema/hotspring.ts";
import { KIND_LIST } from "../vocab/hotspring.ts";
import { hotspringDetailsSchema } from "./details.ts";
import { sampleHotspringDetails } from "./sample.ts";

type D = ReturnType<typeof sampleHotspringDetails>;
const fail = (mutate: (d: D) => void) => {
  const d = sampleHotspringDetails();
  mutate(d);
  const r = hotspringDetailsSchema.safeParse(d);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
};

describe("hotspringDetailsSchema", () => {
  it("架空の見本は通る・空も通る", () => {
    expect(hotspringDetailsSchema.safeParse(sampleHotspringDetails()).success).toBe(true);
    expect(hotspringDetailsSchema.safeParse({}).success).toBe(true);
  });

  it("hours・access は 1 つ。配列（旧い表の形）は弾く", () => {
    expect(hotspringDetailsSchema.safeParse({ hours: [{ opens_at: "10:00" }] }).success).toBe(false);
    expect(hotspringDetailsSchema.safeParse({ access: [{ parking: true }] }).success).toBe(false);
    expect(hotspringDetailsSchema.safeParse({ baths: [{ bath_type: "indoor" }] }).success).toBe(false);
  });

  it.each<[string, (d: D) => void, string]>([
    ["風呂の kind が語彙に無い", (d) => ((d.baths![0] as { kind: string }).kind = "room_open_air"), "baths.0.kind"],
    ["源泉の扱いが語彙に無い", (d) => ((d.baths![0] as { source: string }).source = "boiled"), "baths.0.source"],
    ["男女が語彙に無い", (d) => ((d.baths![0] as { gender: string }).gender = "swaps"), "baths.0.gender"],
    ["予約の枠が 0 分", (d) => (d.baths![2].reservation = { required: true, slot_minutes: 0 }), "baths.2.reservation.slot_minutes"],
    ["風呂の料金の通貨が不正", (d) => (d.baths![2].fee = { amount: 2000, currency: "yen" }), "baths.2.fee.currency"],
    ["営業時間が HH:MM でない", (d) => (d.hours!.close = "21時"), "hours.close"],
    ["amount > amount_max", (d) => (d.fees = [{ amount: 500, amount_max: 100, currency: "JPY" }]), "fees.0.amount_max"],
    ["タオルが語彙に無い", (d) => ((d.amenities as { towel: string }).towel = "paper"), "amenities.towel"],
    ["営業時間にメモは無い", (d) => ((d.hours as Record<string, unknown>).note = { ja: "x" }), "hours"],
  ])("%s", (_name, mutate, path) => {
    const issues = fail(mutate);
    expect(issues.some((i) => i.startsWith(path)), issues.join("\n")).toBe(true);
  });

  it("語彙の kind は DB の check と同じ", () => {
    expect(KIND_LIST.map((t) => t.code).sort()).toEqual(Object.keys(hotspringCore.kindLabels).sort());
  });
});
