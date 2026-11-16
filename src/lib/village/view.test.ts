import { describe, expect, it } from "vitest";
import { sampleVillageDetails } from "./sample.ts";
import { toVillageView, type VillageViewInput } from "./view.ts";

const input = (over: Partial<VillageViewInput> = {}): VillageViewInput => ({ details: sampleVillageDetails(), lat: 34.97, lng: 138.93, locale: "ja", ...over });
const view = (over: Partial<VillageViewInput> = {}) => toVillageView(input(over))!;

describe("toVillageView", () => {
  it("details が無い・形が違う（旧い表の形）ときは null", () => {
    expect(toVillageView(input({ details: null }))).toBeNull();
    expect(toVillageView(input({ details: { access: [{ note: "駅から徒歩" }] } }))).toBeNull();
    expect(toVillageView(input({ details: { walks: [{ key: "a", name: { ja: "a" } }, { key: "a", name: { ja: "b" } }] } }))).toBeNull();
  });

  it("1 行：歩く時間（最初の歩き方）と店の時間", () => {
    expect(view().summary).toEqual({ walkText: "約 60 分", shopText: "10:00〜17:00" });
    expect(view({ details: { walks: [{ key: "a", name: { ja: "a" } }] } }).summary).toEqual({ walkText: null, shopText: null });
    expect(view({ details: {} }).summary).toEqual({ walkText: null, shopText: null });
  });

  it("歩き方・店の時間・催し", () => {
    const v = view();
    expect(v.walks).toEqual([
      { key: "bamboo", label: "竹林と寺めぐり", area: "駅前のバス停から寺まで", durationMinutes: 60, distanceKm: 1.5, summary: "約 60 分・1.5 km", note: "坂が少しある" },
    ]);
    expect(v.shopHours).toEqual({ text: "10:00〜17:00", note: "水曜に休む店が多い" });
    expect(v.events).toEqual([{ name: "もみじ祭り", when: "11 月", note: "夜のライトアップ" }]);
  });

  it("アクセスと地図の位置・注意点・出典", () => {
    const v = view();
    expect(v.access).toMatchObject({ how: "バス 10 分", parking: { text: "あり（有料・200 台）" } });
    expect(v.location).toEqual({ lat: 34.97, lng: 138.93 });
    expect(view({ lat: null }).location).toBeNull();
    expect(v.cautions).toEqual(["夕方以降は店の多くが閉まる"]);
    expect(v.sources).toHaveLength(1);
  });

  it("欄が無ければ空", () => {
    const v = view({ details: {} });
    expect([v.walks, v.shopHours, v.events, v.access, v.cautions, v.sources]).toEqual([[], null, [], null, [], []]);
  });

  it("en：英語の文", () => {
    const v = view({ locale: "en" });
    expect(v.summary).toEqual({ walkText: "About 60 min", shopText: "10:00–17:00" });
    expect(v.walks[0]).toMatchObject({ label: "Bamboo grove and temples", summary: "About 60 min, 1.5 km" });
    expect(v.events[0]).toMatchObject({ when: "Nov" });
  });
});
