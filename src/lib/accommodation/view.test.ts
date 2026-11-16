import { describe, expect, it } from "vitest";
import type { Photo } from "../types.ts";
import { formatMoney, toAccommodationView, toHHMM, type AccommodationViewInput } from "./view.ts";

// wr-ito-033 に似せた details
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
const range = { valid_from: "2026-04-01", valid_to: "2027-03-31" };

const details = () => ({
  rooms: [
    {
      key: "house",
      capacity: 12,
      bedrooms: [
        {
          name: { ja: "1F" },
          beds: [
            { type: "double", count: 1 },
            { type: "single", count: 1 },
          ],
        },
        { name: { ja: "2F" }, beds: [{ type: "semi_double", count: 2 }] },
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
  access: { station: { ja: "伊豆高原駅", en: "Izu-Kogen Station" }, mode: "walk", minutes: 8, route: { ja: "桜並木方面" } },
  prices: {
    seasons: [
      { key: "s1", is_default: true, ...range },
      { key: "s4", priority: 3, ...range },
    ],
    items: [
      itoRoom("s1", 2, 2, 45000),
      itoRoom("s1", 8, 8, 105000),
      itoRoom("s4", 2, 8, 170000),
      { kind: "service_fee", per: "person_night", audience: "all", amount: 550, currency: "JPY", tax_included: true },
      { kind: "bath_tax", per: "person_night", audience: "adult", amount: 300, currency: "JPY" },
    ],
  },
  booking_links: [
    { label: "ステージヴィラ", url: "https://example.com/stagevilla" },
    { label: "公式サイト", url: "https://example.com/official", is_official: true },
  ],
  sources: [
    { name: "公式サイト", url: "https://example.com/official", type: "official", retrieved_at: "2026-11-14", fields: ["定員", "寝室", "料金"] },
    { name: "ステージヴィラ", url: "https://example.com/stagevilla", type: "ota", retrieved_at: "2026-11-14" },
  ],
});

const photo = (url: string): Photo => ({ url, license: null, credit: null, isDemo: false, placeholderSky: null, placeholderLand: null });

const input = (over: Partial<AccommodationViewInput> = {}): AccommodationViewInput => ({
  details: details(),
  checkIn: null,
  checkOut: null,
  officialUrl: "https://example.com/official",
  photos: [
    { photo: photo("a.jpg"), subjectKey: null },
    { photo: photo("b.jpg"), subjectKey: "house" },
    { photo: photo("c.jpg"), subjectKey: "other" },
  ],
  locale: "ja",
  ...over,
});

describe("toAccommodationView", () => {
  const v = toAccommodationView(input())!;

  it("チェックイン・アウトが無ければ null", () => {
    expect(v.stay).toEqual({ checkIn: null, checkOut: null });
  });

  it("DB の時刻は HH:MM にする", () => {
    expect(toAccommodationView(input({ checkIn: "15:00:00", checkOut: "10:00" }))!.stay).toEqual({ checkIn: "15:00", checkOut: "10:00" });
  });

  it("料金（参考）は部屋ごとに 1 行。区分の値は出さない", () => {
    expect(v.priceTable).toEqual({
      unitLabel: "1 棟 1 泊・税込（円）",
      perLabel: "1 棟 1 泊",
      currency: "JPY",
      taxIncluded: true,
      rows: [{ roomLabel: "1 棟", guests: "2〜8", min: 45000, max: 170000, mealsLabels: [] }],
      fees: [
        { label: "諸経費", text: "1 名 1 泊 550 円（税込）" },
        { label: "入湯税", text: "大人 1 名 1 泊 300 円" },
      ],
      children: [],
      officialUrl: "https://example.com/official",
    });
  });

  it("名前の無い 1 部屋は「1 棟」。寝室と寝具を文にし、写真は subject_key で当てる", () => {
    expect(v.rooms).toEqual([
      {
        key: "house",
        label: "1 棟",
        capacity: 12,
        areaSqm: null,
        tatami: null,
        styleLabel: null,
        view: null,
        smokingLabel: null,
        bedrooms: [
          { label: "寝室 1（1F）", beds: "ダブル 1・シングル 1" },
          { label: "寝室 2（2F）", beds: "セミダブル 2" },
          { label: "寝室 3", beds: "セミダブル 2" },
        ],
        photos: [photo("b.jpg")],
      },
    ]);
  });

  it("風呂はラベルで出す（サウナは種類と定員）", () => {
    expect(v.baths.map((b) => [b.label, b.hotSpring, b.saunaStyleLabel, b.capacity])).toEqual([
      ["露天風呂", true, null, null],
      ["内風呂", true, null, null],
      ["サウナ", null, "バレルサウナ", 8],
    ]);
  });

  it("設備は中カテゴリにまとめ、語彙の順に並べる", () => {
    expect(v.amenityGroups).toEqual([
      { label: "キッチン", items: [{ label: "キッチン", options: [], count: null, paid: null, note: null }] },
      { label: "屋外", items: [{ label: "BBQ", options: ["電気グリル", "屋根の下"], count: null, paid: null, note: null }] },
      { label: "通信・仕事", items: [{ label: "Wi-Fi", options: [], count: null, paid: null, note: null }] },
      {
        label: "洗面",
        items: [
          { label: "シャンプー・ボディソープ", options: ["オーガニック"], count: null, paid: null, note: null },
          { label: "ドライヤー", options: [], count: 2, paid: null, note: null },
        ],
      },
      { label: "洗濯", items: [{ label: "洗濯機", options: [], count: null, paid: null, note: null }] },
    ]);
  });

  it("ペット・駐車場・アクセス", () => {
    expect(v.pets).toEqual({ allowed: false, sizeLabel: null, fee: null, note: null });
    expect(v.parking).toEqual({ placeLabel: null, spaces: 2, maxHeightM: null, fee: null, note: null });
    expect(v.access).toMatchObject({ station: "伊豆高原駅", modeLabel: "徒歩", minutes: 8, route: "桜並木方面", needsCar: null });
    expect(toAccommodationView(input({ locale: "en" }))!.access!.station).toBe("Izu-Kogen Station");
  });

  it("無い欄は null か空", () => {
    expect([v.internet, v.conditions, v.surroundings]).toEqual([null, null, null]);
    expect([v.meals, v.cautions, v.licenses]).toEqual([[], [], []]);
  });

  it("予約と出典", () => {
    expect(v.bookingLinks).toEqual([
      { label: "ステージヴィラ", url: "https://example.com/stagevilla", isOfficial: false },
      { label: "公式サイト", url: "https://example.com/official", isOfficial: true },
    ]);
    expect(v.sources).toEqual([
      { name: "公式サイト", url: "https://example.com/official", typeLabel: "公式", retrievedAt: "2026-11-14", fields: ["定員", "寝室", "料金"] },
      { name: "ステージヴィラ", url: "https://example.com/stagevilla", typeLabel: "予約サイト", retrievedAt: "2026-11-14", fields: [] },
    ]);
  });

  it("食事・風呂の詳しい欄・条件も文にする", () => {
    const d = {
      meals: [{ meal: "breakfast", offered: true, style: "buffet", place: "dining_room", served_from: "07:00", served_to: "10:00", fee: { amount: 2500, currency: "JPY" } }],
      baths: [{ kind: "public", hot_spring: true, source: "natural_flow", open_from: "15:00", gender: "separate", reservation: { required: true, when: "at_checkin", slot_minutes: 45 } }],
      rules: { smoking: "none", quiet_from: "22:00", quiet_to: "08:00", min_nights: 2 },
      licenses: [{ kind: "simple_lodging", number: "第 1 号" }],
      cautions: [{ note: { ja: "坂が急" } }],
    };
    const w = toAccommodationView(input({ details: d }))!;
    expect(w.meals[0]).toMatchObject({ label: "朝食", styleLabel: "ビュッフェ", placeLabel: "食事処", hours: "07:00〜10:00", fee: "2,500 円" });
    expect(w.baths[0]).toMatchObject({ label: "大浴場", sourceLabel: "源泉かけ流し", hours: "15:00〜", genderLabel: "男女別", reservation: "要予約・チェックインのとき・45 分" });
    expect(w.conditions).toMatchObject({ smokingLabel: "禁煙", quietHours: "22:00〜08:00", minNights: 2, parties: null });
    expect(w.licenses).toEqual([{ label: "簡易宿所営業", number: "第 1 号" }]);
    expect(w.cautions).toEqual(["坂が急"]);
    expect(w.priceTable).toBeNull();
    expect(w.rooms).toEqual([]);
  });

  it("details が無いか形が違えば null", () => {
    expect(toAccommodationView(input({ details: null }))).toBeNull();
    expect(toAccommodationView(input({ details: { rooms: [{ key: "House!" }] } }))).toBeNull();
    expect(toAccommodationView(input({ details: { nope: true } }))).toBeNull();
  });
});

describe("料金（参考）の表（Codex の指摘）", () => {
  const rooms = [
    { key: "double", name: { ja: "ダブル" } },
    { key: "twin", name: { ja: "ツイン" } },
  ];
  const room = (key: string, amount: number, extra: Record<string, unknown> = {}) => ({
    kind: "room",
    per: "room_night",
    room: key,
    amount,
    currency: "JPY",
    tax_included: true,
    ...extra,
  });
  const seasons = [
    { key: "s1", is_default: true, ...range },
    { key: "s2", priority: 1, ...range },
  ];
  const table = (items: Record<string, unknown>[]) => toAccommodationView(input({ details: { rooms, prices: { seasons, items } } }))!.priceTable!;

  it("[P1] 区分ごとの清掃料・子どもの料金は幅 1 行。区分ごとの行は出さない", () => {
    const t = table([
      room("double", 15000),
      { kind: "cleaning", per: "stay", season: "s1", amount: 1000, currency: "JPY" },
      { kind: "cleaning", per: "stay", season: "s2", amount: 2000, currency: "JPY" },
      { kind: "room", per: "person_night", season: "s1", audience: "child", age_min: 6, age_max: 12, amount: 3000, currency: "JPY" },
      { kind: "room", per: "person_night", season: "s2", audience: "child", age_min: 6, age_max: 12, amount: 5000, currency: "JPY" },
    ]);
    expect(t.fees).toEqual([{ label: "清掃料", text: "1 回の滞在 1,000〜2,000 円" }]);
    expect(t.children).toEqual([{ label: "子ども", text: "6〜12 歳 1 名 1 泊 3,000〜5,000 円" }]);
  });

  it("[P2] 料金の部屋・人数・大人・込みの種類を文に残す", () => {
    const t = table([
      room("double", 15000, { audience: "adult", age_min: 13, includes: ["bath_tax"] }),
      { kind: "cleaning", per: "stay", room: "twin", guests_min: 3, guests_max: 4, amount: 3000, currency: "JPY" },
      { kind: "service_fee", per: "person_night", audience: "adult", amount: 550, currency: "JPY", tax_included: true, includes: ["lodging_tax"] },
    ]);
    expect(t.fees).toEqual([
      { label: "清掃料", text: "ツイン 3〜4 名のとき 1 回の滞在 3,000 円" },
      { label: "諸経費", text: "大人 1 名 1 泊 550 円（税込）・宿泊税込み" },
    ]);
    expect(t.rows[0].note).toBe("大人 13 歳以上・入湯税込み");
  });

  it("どの宿泊料にも込みの料金は fees に残し、「（宿泊料に込み）」を付ける", () => {
    const t = table([
      room("double", 15000, { includes: ["bath_tax"] }),
      room("twin", 16000, { includes: ["bath_tax"] }),
      { kind: "bath_tax", per: "person_night", audience: "adult", amount: 150, currency: "JPY" },
    ]);
    expect(t.fees).toEqual([{ label: "入湯税", text: "大人 1 名 1 泊 150 円（宿泊料に込み）", includedInRoom: true }]);
  });

  it("[P2] 単位の違う宿泊料は、その単位を持つ別の行にする", () => {
    const t = table([room("double", 15000), room("twin", 9000, { per: "person_night" })]);
    expect(t.unitLabel).toBe("1 室 1 泊・税込（円）");
    expect(t.rows).toEqual([
      { roomLabel: "ダブル", guests: null, min: 15000, max: 15000, mealsLabels: [] },
      { roomLabel: "ツイン", guests: null, min: 9000, max: 9000, mealsLabels: [], unitLabel: "1 名 1 泊・税込（円）" },
    ]);
  });

  it("[P2] 大人の宿泊料が無くても、食事の料金だけの表を返す", () => {
    expect(table([{ kind: "meal", per: "person_night", meals: "breakfast", amount: 2500, currency: "JPY" }])).toEqual({
      unitLabel: null,
      perLabel: null,
      currency: null,
      taxIncluded: null,
      rows: [],
      fees: [{ label: "食事", text: "朝食つき 1 名 1 泊 2,500 円" }],
      children: [],
      officialUrl: "https://example.com/official",
    });
  });

  it("[P2] 税別の金額には（税別）を出す（食事・料金）", () => {
    const items = [room("double", 15000), { kind: "bath_tax", per: "person_night", amount: 150, currency: "JPY", tax_included: false }];
    const meals = [{ meal: "dinner", offered: true, fee: { amount: 5000, currency: "JPY", tax_included: false } }];
    const w = toAccommodationView(input({ details: { rooms, prices: { items }, meals } }))!;
    expect(w.priceTable!.fees).toEqual([{ label: "入湯税", text: "1 名 1 泊 150 円（税別）" }]);
    expect(w.meals[0].fee).toBe("5,000 円（税別）");
  });
});

describe("formatMoney / toHHMM", () => {
  it("円は「円」、ほかは通貨コード。税込なら（税込）、税別なら（税別）", () => {
    expect(formatMoney({ amount: 550, currency: "JPY", taxIncluded: false })).toBe("550 円（税別）");
    expect(formatMoney({ amount: 550, currency: "JPY", taxIncluded: true })).toBe("550 円（税込）");
    expect(formatMoney({ amount: 12.5, currency: "USD" })).toBe("12.5 USD");
    expect(formatMoney({ amount: 1000, amountMax: 2000, currency: "JPY" })).toBe("1,000〜2,000 円");
  });
  it("秒を落とし、空は null", () => {
    expect(toHHMM("15:00:00")).toBe("15:00");
    expect(toHHMM(null)).toBeNull();
    expect(toHHMM("")).toBeNull();
  });
});

describe("en の文", () => {
  const e = toAccommodationView(input({ locale: "en" }))!;
  const jp = /[ぁ-んァ-ン一-龥]/;

  it("料金（参考）の表は英語。金額は ¥、範囲は –", () => {
    expect(e.priceTable).toMatchObject({
      unitLabel: "Per house per night · tax incl. (¥)",
      perLabel: "per house per night",
      rows: [{ roomLabel: "Entire house", guests: "2–8", min: 45000, max: 170000, mealsLabels: [] }],
      fees: [
        { label: "Service fee", text: "¥550 per person per night (tax incl.)" },
        { label: "Bath tax", text: "Adults, ¥300 per person per night" },
      ],
    });
  });

  it("部屋・風呂・設備・出典のラベルも英語", () => {
    expect(e.rooms[0].label).toBe("Entire house");
    expect(e.rooms[0].bedrooms).toEqual([
      { label: "Bedroom 1 (1F)", beds: "Double × 1, Single × 1" },
      { label: "Bedroom 2 (2F)", beds: "Semi-double × 2" },
      { label: "Bedroom 3", beds: "Semi-double × 2" },
    ]);
    expect(e.baths.map((b) => [b.label, b.saunaStyleLabel])).toEqual([
      ["Open-air bath", null],
      ["Indoor bath", null],
      ["Sauna", "Barrel sauna"],
    ]);
    expect(e.amenityGroups.map((g) => g.label)).toEqual(["Kitchen", "Outdoor", "Internet and work", "Toiletries", "Laundry"]);
    expect(e.amenityGroups[1].items[0].options).toEqual(["Electric grill", "Covered"]);
    expect(e.access).toMatchObject({ modeLabel: "Walk", minutes: 8 });
    expect(e.sources.map((s) => s.typeLabel)).toEqual(["Official", "Booking site"]);
  });

  it("食事・風呂の予約・年齢・込みの種類も英語", () => {
    const d = {
      rooms: [{ key: "twin", name: { ja: "ツイン", en: "Twin" } }],
      meals: [{ meal: "breakfast", offered: true, style: "buffet", served_from: "07:00", served_to: "10:00", fee: { amount: 2500, currency: "JPY", tax_included: false } }],
      baths: [{ kind: "public", reservation: { required: true, when: "at_checkin", slot_minutes: 45 } }],
      licenses: [{ kind: "simple_lodging" }],
      sources: [{ name: "x", url: "https://example.com", type: "ota", retrieved_at: "2026-11-14", fields: ["rooms", "prices"] }],
      prices: {
        items: [
          { kind: "room", per: "room_night", room: "twin", audience: "adult", age_min: 13, includes: ["bath_tax"], amount: 15000, currency: "JPY" },
          { kind: "room", per: "person_night", audience: "child", age_min: 6, age_max: 12, amount: 3000, amount_max: 5000, currency: "JPY" },
          { kind: "cleaning", per: "stay", room: "twin", guests_min: 3, guests_max: 4, amount: 3000, currency: "JPY" },
        ],
      },
    };
    const w = toAccommodationView(input({ details: d, locale: "en" }))!;
    expect(w.meals[0]).toMatchObject({ label: "Breakfast", styleLabel: "Buffet", hours: "07:00–10:00", fee: "¥2,500 (tax excl.)" });
    expect(w.baths[0].reservation).toBe("Reservation required, At check-in, 45 min");
    expect(w.licenses[0].label).toBe("Simple lodging business");
    expect(w.sources[0].fields).toEqual(["Rooms", "Prices"]);
    expect(w.priceTable!.rows[0].note).toBe("Adults age 13+, incl. bath tax");
    expect(w.priceTable!.children).toEqual([{ label: "Children", text: "ages 6–12, ¥3,000–5,000 per person per night" }]);
    expect(w.priceTable!.fees).toEqual([{ label: "Cleaning fee", text: "Twin, for 3–4 guests, ¥3,000 per stay" }]);
  });

  it("データ（駅名などの ja しかない文）のほかに日本語が残らない", () => {
    const { access, bookingLinks, sources, ...rest } = e;
    expect(JSON.stringify(rest)).not.toMatch(jp);
    expect(access!.modeLabel).not.toMatch(jp);
    expect(bookingLinks.length + sources.length).toBeGreaterThan(0);
  });

  it("formatMoney の en は ¥ と (tax incl.)", () => {
    expect(formatMoney({ amount: 550, currency: "JPY", taxIncluded: true }, "en")).toBe("¥550 (tax incl.)");
    expect(formatMoney({ amount: 1000, amountMax: 2000, currency: "JPY" }, "en")).toBe("¥1,000–2,000");
    expect(formatMoney({ amount: 12.5, currency: "USD", taxIncluded: false }, "en")).toBe("12.5 USD (tax excl.)");
  });
});
