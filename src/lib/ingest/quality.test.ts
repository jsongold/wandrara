import { describe, expect, it } from "vitest";
import type { DestInput } from "./bundle.ts";
import { CORES } from "./cores.ts";
import { checkQuality, QUALITY_RULES } from "./quality.ts";

const loc = { lat: 35.1, lng: 139.07 };
const base = (core: Record<string, unknown>, details: Record<string, unknown>, opts: { address?: boolean } = {}): DestInput => ({
  core: { region_id: "atami", ...core },
  texts: [{ lang: "ja", name: "N", summary: "S", ...(opts.address === false ? {} : { address: "A" }) }],
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
  building: () =>
    base(
      loc,
      { hours: { open: "09:00", close: "17:00" }, fees: [{ audience: "adult", amount: 0, currency: "JPY" }] },
      { address: false },
    ),
  hotspring: () =>
    base(
      loc,
      {
        hours: { open: "10:00", close: "21:00" },
        fees: [{ audience: "adult", amount: 800, currency: "JPY" }],
        baths: [{ kind: "open_air", spring: "単純温泉" }],
      },
      { address: false },
    ),
  nature: () => base(loc, { access: { parking: { available: true } } }, { address: false }),
  village: () => base(loc, { access: { station: { ja: "○○駅" } } }, { address: false }),
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

  it("その国の言語（ja）の name と summary が要る・ほかの言語は任意・prefix が付く", () => {
    const d = complete.nature();
    expect(checkQuality("nature", d, "/dests/3")).toEqual([]);
    const err = ["/dests/3/texts その国の言語（ja）の name と summary が要る"];
    d.texts = [{ lang: "ja", name: "N" }];
    expect(checkQuality("nature", d, "/dests/3")).toEqual(err);
    d.texts = [{ lang: "en", name: "N", summary: "S" }];
    expect(checkQuality("nature", d, "/dests/3")).toEqual(err);
    d.texts = [{ lang: "ja", name: "N", summary: "S" }, { lang: "fr", name: "N" }];
    expect(checkQuality("nature", d, "/dests/3")).toEqual([]);
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
    ["accommodation", "/core/lat", (d) => (d.core.lat = 10)], // 日本の外
    ["accommodation", "/photos", (d) => (d.photos = [])],
    ["accommodation", "/core/official_url", (d) => (d.sources = [])],
    ["experience", "/core/duration_minutes", (d) => delete d.core.duration_minutes],
    ["experience", "/details/locations", (d) => (d.details!.locations = [{ kind: "meeting", lat: 0, lng: 140 }])],
    ["experience", "/details/locations", (d) => delete d.details!.locations],
    // 代表（最初の meeting）が日本の外。2 件目が日本の中でも通さない
    ["experience", "/details/locations", (d) => (d.details!.locations = [{ kind: "meeting", lat: 0, lng: 0 }, { kind: "meeting", ...loc }])],
    ["experience", "/details/locations", (d) => (d.details!.locations = [{ kind: "activity", ...loc }])], // 集合場所が無い
    ["experience", "/details/prices/items", (d) => delete d.details!.prices],
    ["experience", "/details/prices/items", (d) => (d.details!.prices = { items: [{ per: "person", amount: 0, currency: "JPY" }] })],
    ["experience", "/details/prices/items", (d) => (d.details!.prices = { items: [{ amount: 3000, currency: "JPY" }] })],
    ["experience", "/core/official_url", (d) => ((d.sources = []), delete d.core.official_url)],
    ["experience", "/core/official_url", (d) => delete d.core.official_url], // sources だけでは足りない
    ["experience", "/core/official_url", (d) => (delete d.core.official_url, (d.details!.sources = [{ url: "https://example.com/" }]))],
    ["building", "/details/fees", (d) => (d.details!.fees = [{ label: { ja: "要問い合わせ" } }])],
    ["building", "/details/fees", (d) => (d.details!.fees = [{ amount: 500 }])], // currency が無い
    ["building", "/details/fees", (d) => delete d.details!.fees],
    ["building", "/details/hours", (d) => delete d.details!.hours],
    ["building", "/details/hours", (d) => (d.details!.hours = [{ open_time: "09:00" }])], // 旧い表の形
    ["building", "/core/lat", (d) => (d.core.lat = 10)],
    ["hotspring", "/details/fees", (d) => (d.details!.fees = [{ audience: "child", amount: 400, currency: "JPY" }])],
    ["hotspring", "/details/fees", (d) => (d.details!.fees = [{ amount: 800, currency: "JPY" }])], // 区分が無い
    ["hotspring", "/details/hours", (d) => delete d.details!.hours],
    ["hotspring", "/details/baths", (d) => (d.details!.baths = [{ kind: "indoor" }])], // 泉質が無い
    ["hotspring", "/details/baths", (d) => delete d.details!.baths],
    ["hotspring", "/core/lat", (d) => delete d.core.lng],
    ["nature", "/details/access", (d) => delete d.details!.access],
    ["nature", "/core/lat", (d) => (d.core.lat = 10)],
    ["village", "/core/lat", (d) => delete d.core.lng],
    ["village", "/details/access", (d) => delete d.details!.access],
    ["village", "/details/access", (d) => (d.details!.access = [{ note: "駅から徒歩" }])], // 旧い表の形
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

  it("region_id は要らず、箱根・伊豆の外（札幌）の座標でも通る（エリアは取り込みが位置から決める）", () => {
    const d = complete.accommodation();
    delete d.core.region_id;
    Object.assign(d.core, { lat: 43.06, lng: 141.35 });
    expect(checkQuality("accommodation", d)).toEqual([]);
  });

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

  it("experience: 施設の利用（facility_use）は所要時間が無くても、実施場所だけでも通る", () => {
    const d = complete.experience();
    d.core.kind = "facility_use";
    delete d.core.duration_minutes;
    (d.details as { locations: { kind: string }[] }).locations[0].kind = "activity";
    expect(checkQuality("experience", d)).toEqual([]);
  });

  it("experience: 施設の利用でない体験は、実施場所だけでは通らない", () => {
    const d = complete.experience();
    d.core.kind = "tour";
    (d.details as { locations: { kind: string }[] }).locations[0].kind = "activity";
    expect(checkQuality("experience", d).some((e) => e.startsWith("/details/locations"))).toBe(true);
  });

  it("建物・日帰り温泉・まち: 出どころは details.sources[].url でもよい。建物の無料は amount: 0", () => {
    for (const type of ["building", "hotspring", "village"]) {
      const d = complete[type]();
      d.sources = [];
      expect(checkQuality(type, d).map((e) => e.split(" ")[0])).toEqual(["/core/official_url"]);
      d.details!.sources = [{ name: "公式", url: "https://example.com/", type: "official", retrieved_at: "2026-11-16" }];
      expect(checkQuality(type, d)).toEqual([]);
    }
  });

  it("experience: ページへのリンクは booking_links でもよい", () => {
    const d = complete.experience();
    d.sources = [];
    delete d.core.official_url;
    d.details!.booking_links = [{ label: "予約", url: "https://example.com/book" }];
    expect(checkQuality("experience", d)).toEqual([]);
  });
});
