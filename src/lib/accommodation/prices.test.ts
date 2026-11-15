import { describe, expect, it } from "vitest";
import { pricesSchema, seasonFor, type Season } from "./prices.ts";

const range = { valid_from: "2026-04-01", valid_to: "2027-03-31" };
const day = (d: string) => ({ from: d, to: d });

// wr-ito-033 の料金区分
const seasons: Season[] = [
  { key: "s1", is_default: true, priority: 0, ...range },
  {
    key: "s2",
    priority: 1,
    ...range,
    weekdays: [6],
    dates: [
      { from: "2026-04-26", to: "2026-04-30" },
      { from: "2026-08-23", to: "2026-08-28" },
      day("2026-10-11"),
      day("2026-11-22"),
      day("2027-01-10"),
      day("2027-03-21"),
    ],
  },
  {
    key: "s3",
    priority: 2,
    ...range,
    dates: [
      day("2026-05-05"),
      { from: "2026-07-11", to: "2026-08-07" },
      { from: "2026-08-16", to: "2026-08-22" },
      { from: "2026-09-19", to: "2026-09-22" },
      { from: "2026-12-12", to: "2026-12-25" },
      day("2027-01-03"),
    ],
  },
  { key: "s4", priority: 3, ...range, dates: [] },
];

const room = (season: string, guests_min: number, guests_max: number, amount: number) => ({
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

const perGuest = (season: string, base: number) => [2, 3, 4, 5, 6, 7, 8].map((g) => room(season, g, g, base + (g - 2) * 5000));

const itoPrices = () => ({
  seasons: structuredClone(seasons),
  items: [
    ...perGuest("s1", 45000),
    ...perGuest("s2", 55000),
    room("s3", 2, 5, 80000),
    ...[6, 7, 8].map((g) => room("s3", g, g, 80000 + (g - 5) * 5000)),
    room("s4", 2, 8, 120000),
    { kind: "service_fee", per: "person_night", audience: "all", amount: 550, currency: "JPY", tax_included: true },
    { kind: "bath_tax", per: "person_night", audience: "adult", amount: 300, currency: "JPY" },
  ] as Record<string, unknown>[],
});

/** 失敗して、その path に issue が出る */
function failsAt(input: unknown, path: (string | number)[]) {
  const r = pricesSchema.safeParse(input);
  expect(r.success).toBe(false);
  expect(r.error?.issues.map((i) => i.path.join("."))).toContain(path.join("."));
}

describe("pricesSchema", () => {
  it("wr-ito-033 の料金が通る", () => {
    const r = pricesSchema.safeParse(itoPrices());
    expect(r.error?.issues).toBeUndefined();
  });

  it("seasons は省略できる", () => {
    expect(pricesSchema.safeParse({ items: [{ kind: "cleaning", per: "stay", amount: 5000, currency: "JPY" }] }).success).toBe(true);
  });

  it("知らない欄を拒む", () => {
    const p = itoPrices();
    p.items[0].note = "x";
    expect(pricesSchema.safeParse(p).success).toBe(false);
  });

  it("区分の key が重なると失敗", () => {
    const p = itoPrices();
    p.seasons[1].key = "s1";
    failsAt(p, ["seasons", 1, "key"]);
  });

  it("key の形が違うと失敗", () => {
    const p = itoPrices();
    p.seasons[0].key = "S 1";
    failsAt(p, ["seasons", 0, "key"]);
  });

  it("valid_from が valid_to より後だと失敗", () => {
    const p = itoPrices();
    p.seasons[0].valid_from = "2027-04-01";
    failsAt(p, ["seasons", 0, "valid_to"]);
  });

  it("dates の from が to より後だと失敗", () => {
    const p = itoPrices();
    p.seasons[2].dates = [{ from: "2026-05-06", to: "2026-05-05" }];
    failsAt(p, ["seasons", 2, "dates", 0, "to"]);
  });

  it("dates が区分の期間の外だと失敗", () => {
    const p = itoPrices();
    p.seasons[2].dates = [{ from: "2027-03-30", to: "2027-04-02" }];
    failsAt(p, ["seasons", 2, "dates", 0]);
  });

  it("日付の形が違うと失敗", () => {
    const p = itoPrices();
    p.seasons[0].valid_to = "2027-02-30";
    failsAt(p, ["seasons", 0, "valid_to"]);
  });

  it("曜日が 1〜7 の整数でないと失敗", () => {
    for (const w of [0, 8, 1.5]) {
      const p = itoPrices();
      p.seasons[1].weekdays = [w];
      failsAt(p, ["seasons", 1, "weekdays", 0]);
    }
  });

  it("曜日が重なると失敗", () => {
    const p = itoPrices();
    p.seasons[1].weekdays = [6, 6];
    failsAt(p, ["seasons", 1, "weekdays"]);
  });

  it("items の season が seasons に無いと失敗", () => {
    const p = itoPrices();
    p.items[0].season = "s9";
    failsAt(p, ["items", 0, "season"]);
    failsAt({ items: [p.items[0]] }, ["items", 0, "season"]);
  });

  it("guests_min が guests_max より大きいと失敗", () => {
    const p = itoPrices();
    Object.assign(p.items[0], { guests_min: 4, guests_max: 3 });
    failsAt(p, ["items", 0, "guests_max"]);
  });

  it("guests が 1 未満・整数でないと失敗", () => {
    for (const g of [0, 2.5]) {
      const p = itoPrices();
      p.items[0].guests_min = g;
      failsAt(p, ["items", 0, "guests_min"]);
    }
  });

  it("age_min が age_max より大きいと失敗", () => {
    const p = itoPrices();
    Object.assign(p.items[0], { age_min: 13, age_max: 6 });
    failsAt(p, ["items", 0, "age_max"]);
  });

  it("age が負だと失敗", () => {
    const p = itoPrices();
    p.items[0].age_min = -1;
    failsAt(p, ["items", 0, "age_min"]);
  });

  it("amount が amount_max より大きいと失敗", () => {
    const p = itoPrices();
    p.items[0].amount_max = 40000;
    failsAt(p, ["items", 0, "amount_max"]);
  });

  it("amount と rate_percent の両方・どちらも無いと失敗", () => {
    const both = itoPrices();
    both.items[0].rate_percent = 50;
    failsAt(both, ["items", 0]);
    const neither = itoPrices();
    delete neither.items[0].amount;
    failsAt(neither, ["items", 0]);
  });

  it("rate_percent だけなら通る。0〜100 の外は失敗", () => {
    const child = { kind: "room", per: "person_night", audience: "child", age_min: 6, age_max: 12, rate_percent: 70, currency: "JPY" };
    expect(pricesSchema.safeParse({ items: [child] }).success).toBe(true);
    failsAt({ items: [{ ...child, rate_percent: 120 }] }, ["items", 0, "rate_percent"]);
  });

  it("通貨が 3 文字の大文字でないと失敗", () => {
    const p = itoPrices();
    p.items[0].currency = "jpy";
    failsAt(p, ["items", 0, "currency"]);
  });

  it("includes が重なる・自分の種類を入れると失敗", () => {
    const dup = itoPrices();
    dup.items[0].includes = ["cleaning", "cleaning"];
    failsAt(dup, ["items", 0, "includes"]);
    const self = itoPrices();
    const last = self.items.length - 1; // bath_tax
    self.items[last].includes = ["bath_tax"];
    failsAt(self, ["items", last, "includes"]);
  });

  it("room は key の形だけ確かめる", () => {
    const p = itoPrices();
    p.items[0].room = "Main House";
    failsAt(p, ["items", 0, "room"]);
  });
});

describe("seasonFor", () => {
  it("平日は既定の s1", () => {
    expect(seasonFor("2026-04-20", seasons)?.key).toBe("s1"); // 月
  });

  it("土曜は s2", () => {
    expect(seasonFor("2026-04-18", seasons)?.key).toBe("s2");
  });

  it("s2 の日付の一覧に当たる平日も s2", () => {
    expect(seasonFor("2026-04-28", seasons)?.key).toBe("s2"); // 火
  });

  it("s3 の日付の土曜は priority の高い s3", () => {
    expect(seasonFor("2026-07-11", seasons)?.key).toBe("s3"); // 土。s2 も当たる
  });

  it("valid_to より後は undefined（期限切れの既定を返さない）", () => {
    expect(seasonFor("2027-04-05", seasons)).toBeUndefined();
  });

  it("日曜は ISO の 7", () => {
    const sun: Season[] = [{ key: "sun", ...range, weekdays: [7] }];
    expect(seasonFor("2026-04-19", sun)?.key).toBe("sun");
    expect(seasonFor("2026-04-18", sun)).toBeUndefined();
  });
});
