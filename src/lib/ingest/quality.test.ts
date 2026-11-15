import { describe, expect, it } from "vitest";
import type { DestInput } from "./bundle.ts";
import { CORES } from "./cores.ts";
import { checkQuality, QUALITY_RULES } from "./quality.ts";

const loc = { lat: 35.1, lng: 139.07 };
const base = (core: Record<string, unknown>, details: Record<string, Record<string, unknown>[]>, opts: { address?: boolean } = {}): DestInput => ({
  core: { region_id: "atami", ...core },
  texts: [{ lang: "en", name: "N", summary: "S", ...(opts.address === false ? {} : { address: "A" }) }],
  details,
  photos: [{ storage_key: "a.jpg" }],
  sources: [{ url: "https://example.com/" }],
});

/** 種類ごとに、決まりを全部満たす入力 */
const complete: Record<string, () => DestInput> = {
  accommodation: () =>
    base({ ...loc, check_in: "15:00", check_out: "10:00" }, { units: [{ capacity: 4 }], prices: [{ amount: "20000", currency: "JPY", guests: 2 }] }),
  experience: () =>
    base({ duration_minutes: 90, official_url: "https://example.com/" }, { prices: [{ amount: 3000, currency: "JPY" }], locations: [loc] }, { address: false }),
  building: () => base(loc, { hours: [{ open_time: "09:00" }], fees: [{ amount: 0, currency: "JPY" }] }),
  hotspring: () =>
    base(loc, { hours: [{ opens_at: "10:00" }], fees: [{ fee_kind: "adult", amount: 800, currency: "JPY" }], baths: [{ spring_quality: "単純温泉" }] }),
  nature: () => base(loc, { access: [{ has_parking: true }] }, { address: false }),
  village: () => base(loc, { access: [{ note: "駅から徒歩" }] }, { address: false }),
};

describe("checkQuality", () => {
  it("決まりはすべての種類にある", () => {
    expect(Object.keys(QUALITY_RULES).sort()).toEqual(CORES.map((c) => c.coreType).sort());
  });

  for (const [type, make] of Object.entries(complete)) {
    it(`${type}: すべて満たせば通る`, () => {
      expect(checkQuality(type, make())).toEqual([]);
    });
  }

  it("言語は問わない（en だけでも通る）・prefix が付く", () => {
    const d = complete.nature();
    expect(checkQuality("nature", d, "/dests/3")).toEqual([]);
    d.texts = [{ lang: "ja", name: "N" }];
    expect(checkQuality("nature", d, "/dests/3")).toEqual(["/dests/3/texts name と summary が要る（どの言語でもよい）"]);
  });

  const missing: [string, string, (d: DestInput) => void][] = [
    ["accommodation", "/details/prices", (d) => (d.details!.prices = [])],
    ["accommodation", "/details/prices", (d) => (d.details!.prices = [{ amount: 0, currency: "JPY", guests: 2 }])],
    ["accommodation", "/details/units", (d) => (d.details!.units = [{ name: "和室" }])],
    ["accommodation", "/core/check_in", (d) => delete d.core.check_out],
    ["accommodation", "/texts", (d) => delete d.texts[0].address],
    ["accommodation", "/core/lat", (d) => (d.core.lat = 26.2)], // 那覇：範囲の外
    ["accommodation", "/photos", (d) => (d.photos = [])],
    ["accommodation", "/core/region_id", (d) => delete d.core.region_id],
    ["accommodation", "/core/official_url", (d) => (d.sources = [])],
    ["experience", "/core/duration_minutes", (d) => delete d.core.duration_minutes],
    ["experience", "/details/locations", (d) => (d.details!.locations = [{ lat: 40, lng: 140 }])],
    ["experience", "/core/official_url", (d) => delete d.core.official_url],
    ["building", "/details/fees", (d) => (d.details!.fees = [{ label: "要問い合わせ" }])],
    ["building", "/details/hours", (d) => delete d.details!.hours],
    ["hotspring", "/details/fees", (d) => (d.details!.fees = [{ fee_kind: "child", amount: 400 }])],
    ["hotspring", "/details/baths", (d) => (d.details!.baths = [{ bath_type: "outdoor" }])],
    ["nature", "/details/access", (d) => (d.details!.access = [])],
    ["village", "/core/lat", (d) => delete d.core.lng],
  ];
  for (const [type, path, drop] of missing) {
    it(`${type}: ${path} が欠けると弾く`, () => {
      const d = complete[type]();
      drop(d);
      const errors = checkQuality(type, d);
      expect(errors).toHaveLength(1);
      expect(errors[0].startsWith(`${path} `)).toBe(true);
    });
  }
});
