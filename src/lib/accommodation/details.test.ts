import { describe, expect, it } from "vitest";
import { bathSchema, detailsBaseSchema, type DetailsBase } from "./details.ts";

// wr-ito-033 の事実から作った、全部入りの例
const full = (): DetailsBase => ({
  rooms: [
    {
      key: "house",
      capacity: 12,
      bedrooms: [
        {
          beds: [
            { type: "double", count: 1 },
            { type: "single", count: 1 },
          ],
        },
        { beds: [{ type: "semi_double", count: 2 }] },
        { beds: [{ type: "semi_double", count: 2 }] },
      ],
    },
  ],
  baths: [
    { kind: "open_air", hot_spring: true },
    { kind: "indoor", hot_spring: true },
    { kind: "sauna", sauna_style: "barrel", capacity: 8 },
  ],
  amenities: [
    { code: "kitchen" },
    { code: "bbq", options: ["electric_grill", "covered"] },
    { code: "wifi" },
    { code: "hair_dryer", count: 2 },
    { code: "washing_machine" },
    { code: "shampoo", options: ["organic"] },
  ],
  pets: { allowed: false },
  parking: { spaces: 2 },
  access: { station: { ja: "伊豆高原駅" }, mode: "walk", minutes: 8 },
  booking_links: [
    { label: "ステージヴィラ", url: "https://example.com/stagevilla", is_official: true },
    { label: "ACO", url: "https://example.com/aco" },
  ],
  sources: [
    { name: "公式サイト", url: "https://example.com/stagevilla", type: "official", retrieved_at: "2026-11-14" },
    { name: "ACO", url: "https://example.com/aco", type: "ota", retrieved_at: "2026-11-14" },
  ],
});

// 失敗したときの path とメッセージ
function issues(input: unknown) {
  const r = detailsBaseSchema.safeParse(input);
  expect(r.success).toBe(false);
  return r.success ? [] : r.error.issues.map((i) => ({ path: i.path.join("."), code: i.code, message: i.message }));
}

describe("detailsBaseSchema", () => {
  it("全部入りの例が通る", () => {
    const r = detailsBaseSchema.safeParse(full());
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });

  it("空でも通る（すべて省略できる）", () => {
    expect(detailsBaseSchema.safeParse({}).success).toBe(true);
  });

  it("rooms[].key が重なると落ちる", () => {
    const d = full();
    d.rooms!.push({ key: "house" });
    expect(issues(d)).toEqual([{ path: "rooms.1.key", code: "custom", message: "部屋の key が重なっている: house" }]);
  });

  it("kind≠sauna の sauna_style は落ちる", () => {
    const d = full();
    d.baths![0] = { kind: "open_air", sauna_style: "barrel" };
    expect(issues(d)).toEqual([
      { path: "baths.0.sauna_style", code: "custom", message: "sauna_style は kind=sauna のときだけ書ける（kind=open_air）" },
    ]);
  });

  it("amenityOptions に無い option は落ちる", () => {
    const d = full();
    d.amenities![1] = { code: "bbq", options: ["electric_grill", "organic"] };
    d.amenities![0] = { code: "kitchen", options: ["gas"] };
    expect(issues(d)).toEqual([
      { path: "amenities.0.options.0", code: "custom", message: "kitchen に付けられない option: gas（使える値: なし）" },
      {
        path: "amenities.1.options.1",
        code: "custom",
        message: "bbq に付けられない option: organic（使える値: electric_grill, charcoal, gas, covered）",
      },
    ]);
  });

  it("知らない欄は落ちる（いちばん上・中）", () => {
    expect(issues({ ...full(), prices: { items: [] } }).map((i) => i.code)).toEqual(["unrecognized_keys"]);
    const d = full() as Record<string, unknown>;
    d.pets = { allowed: false, color: "black" };
    expect(issues(d)).toMatchObject([{ path: "pets", code: "unrecognized_keys" }]);
  });

  it("知らない語彙のコードは落ちる", () => {
    const cases: [string, (d: Record<string, unknown>) => void][] = [
      ["baths.0.kind", (d) => ((d.baths as unknown[])[0] = { kind: "jacuzzi" })],
      ["amenities.0.code", (d) => ((d.amenities as unknown[])[0] = { code: "helipad" })],
      ["rooms.0.bedrooms.0.beds.0.type", (d) => (((d.rooms as DetailsBase["rooms"])![0].bedrooms![0].beds[0] as { type: string }).type = "hammock")],
      ["access.mode", (d) => (d.access = { mode: "boat" })],
      ["sources.0.type", (d) => ((d.sources as { type: string }[])[0].type = "blog")],
    ];
    for (const [path, mutate] of cases) {
      const d = full() as Record<string, unknown>;
      mutate(d);
      expect(issues(d)).toMatchObject([{ path, code: "invalid_value" }]);
    }
  });

  it("時刻・日付・通貨・key・数の形", () => {
    const bad: [string, Record<string, unknown>][] = [
      ["baths.0.open_from", { baths: [{ kind: "indoor", open_from: "24:00" }] }],
      ["sources.0.retrieved_at", { sources: [{ name: "x", url: "https://example.com/", type: "other", retrieved_at: "2026/11/14" }] }],
      ["parking.fee.currency", { parking: { fee: { amount: 500, currency: "jpy" } } }],
      ["rooms.0.key", { rooms: [{ key: "House 1" }] }],
      ["parking.spaces", { parking: { spaces: 1.5 } }],
      ["pets.fee.amount", { pets: { allowed: true, fee: { amount: -1, currency: "JPY" } } }],
      ["booking_links.0.url", { booking_links: [{ label: "x", url: "ftp://example.com/" }] }],
    ];
    for (const [path, input] of bad) expect(issues(input).map((i) => i.path)).toEqual([path]);
  });
});

describe("bathSchema", () => {
  it("サウナでも sauna_style は省略できる", () => {
    expect(bathSchema.safeParse({ kind: "sauna" }).success).toBe(true);
  });
});
