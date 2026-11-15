import { describe, expect, it } from "vitest";
import { priceHint } from "./price-hint.ts";
import { pricesSchema, type PriceItem, type Prices } from "./prices.ts";

const range = { valid_from: "2026-04-01", valid_to: "2027-03-31" };

// 形の正しい料金だけを使う
const prices = (items: Record<string, unknown>[], seasons: Record<string, unknown>[] = []): Prices =>
  pricesSchema.parse({ seasons, items });

// ---- wr-ito-033（1 棟貸し、区分 s1〜s4） ----

const itoRoom = (season: string, guests_min: number, guests_max: number, amount: number) => ({
  kind: "room",
  per: "house_night",
  room: "house",
  season,
  guests_min,
  guests_max,
  amount,
  currency: "JPY",
  tax_included: true,
});
const perGuest = (season: string, base: number, step: number) => [2, 3, 4, 5, 6, 7, 8].map((g) => itoRoom(season, g, g, base + (g - 2) * step));
const serviceFee = { kind: "service_fee", per: "person_night", audience: "all", amount: 550, currency: "JPY", tax_included: true };
const bathTax = { kind: "bath_tax", per: "person_night", audience: "adult", amount: 300, currency: "JPY" };

const ito = prices(
  [
    ...perGuest("s1", 45000, 5000),
    ...perGuest("s2", 55000, 5000),
    itoRoom("s3", 2, 5, 80000),
    ...[6, 7, 8].map((g) => itoRoom("s3", g, g, 80000 + (g - 5) * 5000)),
    ...perGuest("s4", 110000, 10000),
    serviceFee,
    bathTax,
  ],
  ["s1", "s2", "s3", "s4"].map((key, i) => ({ key, priority: i, ...range, ...(i === 0 ? { is_default: true } : {}) })),
);

// ---- ホテル（3 部屋） ----

const hotelRoom = (room: string, amount: number, amount_max: number, extra: Record<string, unknown> = {}) => ({
  kind: "room",
  per: "room_night",
  room,
  amount,
  amount_max,
  currency: "JPY",
  tax_included: true,
  guests_min: 1,
  guests_max: 2,
  ...extra,
});
const hotelRooms = [{ key: "double" }, { key: "twin" }, { key: "japanese_western" }];

describe("priceHint", () => {
  it("wr-ito-033：1 行にまとめ、区分の値は出さない", () => {
    const h = priceHint({ rooms: [{ key: "house" }], prices: ito });
    expect(h).toEqual({
      per: "house_night",
      currency: "JPY",
      taxIncluded: true,
      rows: [{ room: "house", guestsMin: 2, guestsMax: 8, min: 45000, max: 170000, meals: [] }],
      fees: [serviceFee, bathTax],
      children: [],
      issues: [],
    });
    expect(JSON.stringify(h)).not.toContain("season");
  });

  it("ホテル：rooms の順に 3 行、room の無い料金は最後", () => {
    const p = prices([
      hotelRoom("japanese_western", 30000, 42000, { meals: "both", guests_max: 4 }),
      { ...hotelRoom("twin", 18000, 22000, { meals: "breakfast" }), room: undefined },
      hotelRoom("twin", 16000, 20000, { meals: "none" }),
      hotelRoom("twin", 18000, 24000, { meals: "breakfast" }),
      hotelRoom("double", 15000, 19000),
    ]);
    const h = priceHint({ rooms: hotelRooms, prices: p })!;
    expect(h.per).toBe("room_night");
    expect(h.rows).toEqual([
      { room: "double", guestsMin: 1, guestsMax: 2, min: 15000, max: 19000, meals: [] },
      { room: "twin", guestsMin: 1, guestsMax: 2, min: 16000, max: 24000, meals: ["none", "breakfast"] },
      { room: "japanese_western", guestsMin: 1, guestsMax: 4, min: 30000, max: 42000, meals: ["both"] },
      { room: null, guestsMin: 1, guestsMax: 2, min: 18000, max: 22000, meals: ["breakfast"] },
    ]);
  });

  it("部屋が 1 つなら room の無い料金はその部屋に入る", () => {
    const p = prices([{ kind: "room", per: "house_night", amount: 40000, currency: "JPY", guests_min: 2 }]);
    expect(priceHint({ rooms: [{ key: "house" }], prices: p })!.rows).toEqual([
      { room: "house", guestsMin: 2, guestsMax: 2, min: 40000, max: 40000, meals: [] },
    ]);
  });

  it("単位か通貨の違う宿泊料は比べず issues に出す", () => {
    const p = prices([
      hotelRoom("double", 15000, 19000),
      { ...hotelRoom("twin", 9000, 9000), per: "person_night" },
      hotelRoom("twin", 16000, 20000),
      { ...hotelRoom("double", 100, 120), currency: "USD" },
    ]);
    const h = priceHint({ rooms: hotelRooms, prices: p })!;
    expect(h.per).toBe("room_night");
    expect(h.currency).toBe("JPY");
    expect(h.rows.map((r) => [r.room, r.min, r.max])).toEqual([
      ["double", 15000, 19000],
      ["twin", 16000, 20000],
    ]);
    expect(h.issues).toEqual(["単位か通貨の違う宿泊料があり、比べていない（2 件）"]);
  });

  it("同じ数なら先に出た単位を使う", () => {
    const p = prices([{ ...hotelRoom("twin", 9000, 9000), per: "person_night" }, hotelRoom("double", 15000, 19000)]);
    expect(priceHint({ rooms: hotelRooms, prices: p })!.per).toBe("person_night");
  });

  it("税込が混ざると taxIncluded は null、全部税別なら false", () => {
    const mixed = prices([hotelRoom("double", 15000, 19000), { ...hotelRoom("twin", 16000, 20000), tax_included: undefined }]);
    expect(priceHint({ rooms: hotelRooms, prices: mixed })!.taxIncluded).toBeNull();
    const excl = prices([{ ...hotelRoom("double", 15000, 19000), tax_included: false }]);
    expect(priceHint({ rooms: hotelRooms, prices: excl })!.taxIncluded).toBe(false);
  });

  it("どの宿泊料にも込みの種類は fees に出さない", () => {
    const meal = { kind: "meal", per: "person_night", amount: 5000, currency: "JPY", meals: "dinner" };
    const cleaning = { kind: "cleaning", per: "stay", amount: 8000, currency: "JPY" };
    const p = prices([
      hotelRoom("double", 15000, 19000, { includes: ["bath_tax", "cleaning"] }),
      hotelRoom("twin", 16000, 20000, { includes: ["bath_tax"] }),
      bathTax,
      cleaning,
      meal,
    ]);
    expect(priceHint({ rooms: hotelRooms, prices: p })!.fees).toEqual([cleaning, meal]);
  });

  it("子どもの料金と割合の料金は children に入り、行には入らない", () => {
    const childRate = { kind: "room", per: "person_night", rate_percent: 70, currency: "JPY", audience: "child", age_min: 6, age_max: 11 };
    const childAmount = { kind: "room", per: "room_night", room: "double", amount: 1000, currency: "JPY", audience: "child" };
    const p = prices([hotelRoom("double", 15000, 19000, { audience: "adult" }), childRate, childAmount]);
    const h = priceHint({ rooms: hotelRooms, prices: p })!;
    expect(h.rows).toEqual([{ room: "double", guestsMin: 1, guestsMax: 2, min: 15000, max: 19000, meals: [] }]);
    expect(h.children).toEqual([childRate, childAmount] as PriceItem[]);
  });

  it("宿泊料が無ければ null", () => {
    expect(priceHint({ rooms: hotelRooms, prices: prices([serviceFee]) })).toBeNull();
    expect(priceHint({ rooms: hotelRooms })).toBeNull();
    expect(priceHint({})).toBeNull();
    const onlyChild = prices([{ kind: "room", per: "person_night", rate_percent: 50, currency: "JPY" }]);
    expect(priceHint({ prices: onlyChild })).toBeNull();
  });
});
