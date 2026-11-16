import { describe, expect, it } from "vitest";
import type { DestInput } from "./bundle.ts";
import { CORES } from "./cores.ts";
import { checkQuality, QUALITY_RULES } from "./quality.ts";

const loc = { lat: 35.1, lng: 139.07 };
const base = (core: Record<string, unknown>, details: Record<string, unknown>, opts: { address?: boolean } = {}): DestInput => ({
  core: { region_id: "atami", ...core },
  texts: [{ lang: "en", name: "N", summary: "S", ...(opts.address === false ? {} : { address: "A" }) }],
  details,
  photos: [{ storage_key: "a.jpg" }],
  sources: [{ url: "https://example.com/" }],
});

/** 種類ごとに、決まりを全部満たす入力 */
const complete: Record<string, () => DestInput> = {
  accommodation: () =>
    base(
      { ...loc, check_in: "15:00", check_out: "10:00" },
      { rooms: [{ key: "main", capacity: 4 }], prices: { items: [{ kind: "room", per: "room_night", room: "main", amount: 20000, currency: "JPY" }] } },
    ),
  experience: () =>
    base(
      { duration_minutes: 90, official_url: "https://example.com/" },
      { prices: { items: [{ per: "person", amount: 3000, currency: "JPY" }] }, locations: [{ kind: "meeting", ...loc, geo_precision: "exact" }] },
      { address: false },
    ),
  building: () => base(loc, { hours: [{ open_time: "09:00" }], fees: [{ amount: 0, currency: "JPY" }] }),
  hotspring: () =>
    base(loc, { hours: [{ opens_at: "10:00" }], fees: [{ fee_kind: "adult", amount: 800, currency: "JPY" }], baths: [{ spring_quality: "単純温泉" }] }),
  nature: () => base(loc, { access: { parking: { available: true } } }, { address: false }),
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

  type AccDetails = { rooms: Record<string, unknown>[]; prices: { items: Record<string, unknown>[] } };
  const acc = (d: DestInput) => d.details as AccDetails;
  const missing: [string, string, (d: DestInput) => void][] = [
    ["accommodation", "/details/prices/items", (d) => (acc(d).prices.items = [])],
    ["accommodation", "/details/prices/items", (d) => (acc(d).prices.items[0].amount = 0)],
    ["accommodation", "/details/prices/items", (d) => (acc(d).prices.items[0].kind = "cleaning")],
    ["accommodation", "/details/prices/items", (d) => delete d.details!.prices],
    ["accommodation", "/details/rooms", (d) => delete acc(d).rooms[0].capacity],
    ["accommodation", "/photos", (d) => (d.photos = [{ storage_key: "a.jpg", room: "annex" }])],
    ["accommodation", "/core/check_in", (d) => delete d.core.check_out],
    ["accommodation", "/texts", (d) => delete d.texts[0].address],
    ["accommodation", "/core/lat", (d) => (d.core.lat = 26.2)], // 那覇：範囲の外
    ["accommodation", "/photos", (d) => (d.photos = [])],
    ["accommodation", "/core/region_id", (d) => delete d.core.region_id],
    ["accommodation", "/core/official_url", (d) => (d.sources = [])],
    ["experience", "/core/duration_minutes", (d) => delete d.core.duration_minutes],
    ["experience", "/details/locations", (d) => (d.details!.locations = [{ kind: "meeting", lat: 40, lng: 140 }])],
    ["experience", "/details/locations", (d) => delete d.details!.locations],
    ["experience", "/details/locations", (d) => (d.details!.locations = [{ kind: "activity", ...loc }])], // 集合場所が無い
    ["experience", "/details/prices/items", (d) => delete d.details!.prices],
    ["experience", "/details/prices/items", (d) => (d.details!.prices = { items: [{ per: "person", amount: 0, currency: "JPY" }] })],
    ["experience", "/details/prices/items", (d) => (d.details!.prices = { items: [{ amount: 3000, currency: "JPY" }] })],
    ["experience", "/core/official_url", (d) => ((d.sources = []), delete d.core.official_url)],
    ["experience", "/core/official_url", (d) => delete d.core.official_url], // sources だけでは足りない
    ["experience", "/core/official_url", (d) => (delete d.core.official_url, (d.details!.sources = [{ url: "https://example.com/" }]))],
    ["building", "/details/fees", (d) => (d.details!.fees = [{ label: "要問い合わせ" }])],
    ["building", "/details/hours", (d) => delete d.details!.hours],
    ["hotspring", "/details/fees", (d) => (d.details!.fees = [{ fee_kind: "child", amount: 400 }])],
    ["hotspring", "/details/baths", (d) => (d.details!.baths = [{ bath_type: "outdoor" }])],
    ["nature", "/details/access", (d) => delete d.details!.access],
    ["nature", "/core/lat", (d) => (d.core.lat = 26.2)],
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

  it("accommodation: 写真の room が rooms にあれば通る", () => {
    const d = complete.accommodation();
    d.photos = [{ storage_key: "a.jpg", room: "main" }, { storage_key: "b.jpg" }];
    expect(checkQuality("accommodation", d)).toEqual([]);
  });

  it("accommodation: 出どころは details.sources[].url でもよい", () => {
    const d = complete.accommodation();
    d.sources = [];
    (d.details as Record<string, unknown>).sources = [{ name: "公式", url: "https://example.com/", type: "official", retrieved_at: "2026-11-15" }];
    expect(checkQuality("accommodation", d)).toEqual([]);
  });

  it("experience: ページへのリンクは booking_links でもよい", () => {
    const d = complete.experience();
    d.sources = [];
    delete d.core.official_url;
    d.details!.booking_links = [{ label: "予約", url: "https://example.com/book" }];
    expect(checkQuality("experience", d)).toEqual([]);
  });
});
