// 宿の詳細の画面に出す形。details（jsonb）を、ラベルと文字にしてから渡す。画面は並べるだけ
import { resolveLocalizedText } from "../feed.ts";
import type { Locale, Photo } from "../types.ts";
import {
  ACCESS_MODE_LIST,
  AMENITY_GROUP_LIST,
  AMENITY_LIST,
  amenityGroupOf,
  amenityOptions,
  BATH_GENDER_LIST,
  BATH_KIND_LIST,
  BED_TYPE_LIST,
  DESK_SCOPE_LIST,
  HOT_SPRING_SOURCE_LIST,
  labelOf,
  MEAL_LIST,
  MEAL_PLACE_LIST,
  MEAL_STYLE_LIST,
  PARKING_PLACE_LIST,
  PET_SIZE_LIST,
  PRICE_AUDIENCE_LIST,
  PRICE_KIND_LIST,
  PRICE_MEALS_LIST,
  PRICE_PER_LIST,
  RESERVATION_TIMING_LIST,
  ROOM_STYLE_LIST,
  SAUNA_STYLE_LIST,
  SMOKING_LIST,
  SOURCE_TYPE_LIST,
  type Term,
} from "../vocab/accommodation.ts";
import type { LocalizedText, Money } from "./details.ts";
import { priceHint, type PriceLine, type PriceWho } from "./price-hint.ts";
import { accommodationDetailsSchema, type AccommodationDetails } from "./schema.ts";

// ---- 出力の形（値の無い欄は null）----

/** 見出しと文の 1 行（「諸経費」「1 名 1 泊 550 円（税込）」） */
export type LabeledText = {
  label: string;
  text: string;
  includedInRoom?: true; // 宿泊料に込み（「別途かかる」に数えない）。text の最後に「（宿泊料に込み）」
};

export type PriceTableRow = {
  roomLabel: string; // 部屋の名前。名前の無い 1 部屋は「1 棟」
  guests: string | null; // 料金がかかる人数（「2〜8」）
  min: number;
  max: number;
  mealsLabels: string[]; // 素泊まり・2 食つき
  unitLabel?: string; // 表の単位と違う行だけ（「1 名 1 泊・税込（円）」）。min・max はこの単位
  note?: string; // 行を開いたときの文（「大人・入湯税込み」）
};

export type PriceTable = {
  unitLabel: string | null; // 「1 棟 1 泊・税込（円）」。rows が空なら null
  perLabel: string | null; // 「1 棟 1 泊」。rows が空なら null
  currency: string | null; // JPY など。rows が空なら null
  taxIncluded: boolean | null; // 混ざっているか分からないときは null
  rows: PriceTableRow[]; // 大人の宿泊料が無ければ空（fees・children だけ出す）
  fees: LabeledText[]; // 別にかかる料金（諸経費・入湯税）
  children: LabeledText[]; // 子どもの料金
  officialUrl: string | null; // 「料金の詳細は公式サイトへ」
};

export type RoomView = {
  key: string;
  label: string;
  capacity: number | null;
  areaSqm: number | null;
  tatami: number | null;
  styleLabel: string | null;
  view: string | null;
  smokingLabel: string | null;
  bedrooms: { label: string; beds: string }[]; // 「寝室 1（1F）」「ダブル 1・シングル 1」
  photos: Photo[];
};

export type MealView = {
  label: string; // 朝食・夕食
  offered: boolean; // false＝出ない
  styleLabel: string | null;
  placeLabel: string | null;
  hours: string | null; // 「07:00〜10:00」
  slots: string[]; // 選べる開始時刻
  fee: string | null;
  allergyConsult: boolean | null;
  selfCook: boolean | null;
  note: string | null;
};

export type BathView = {
  label: string; // 露天風呂・サウナ など
  saunaStyleLabel: string | null;
  hotSpring: boolean | null;
  spring: string | null; // 泉質
  sourceLabel: string | null; // 源泉かけ流し など
  capacity: number | null;
  coldBath: boolean | null;
  outdoorRest: boolean | null;
  hours: string | null;
  genderLabel: string | null;
  reservation: string | null; // 「要予約・チェックインのとき・45 分」
  fee: string | null;
  note: string | null;
};

export type AmenityView = { label: string; options: string[]; count: number | null; paid: boolean | null; note: string | null };
export type AmenityGroupView = { label: string; items: AmenityView[] };

export type InternetView = {
  wifi: boolean | null;
  downMbps: number | null;
  upMbps: number | null;
  measuredAt: string | null;
  deskLabel: string | null;
  note: string | null;
};

export type PetsView = { allowed: boolean; sizeLabel: string | null; fee: string | null; note: string | null };

export type ConditionsView = {
  smokingLabel: string | null;
  parties: boolean | null;
  fireworks: boolean | null;
  quietHours: string | null; // 「22:00〜08:00」
  bbqUntil: string | null;
  minNights: number | null;
  garbage: string | null;
  note: string | null;
};

export type ParkingView = { placeLabel: string | null; spaces: number | null; maxHeightM: number | null; fee: string | null; note: string | null };

export type AccessView = {
  station: string | null;
  modeLabel: string | null; // 徒歩・バス など
  minutes: number | null;
  shuttle: boolean | null;
  slopeOrStairs: boolean | null;
  needsCar: boolean | null;
  winterRestriction: string | null;
  route: string | null;
};

export type SurroundingsView = {
  neighborDistanceM: number | null;
  sightlines: string | null;
  noiseSources: string | null;
  view: string | null;
  elevationM: number | null;
};

export type AccommodationView = {
  stay: { checkIn: string | null; checkOut: string | null }; // "HH:MM"。必須だが古いデータには無い
  priceTable: PriceTable | null;
  rooms: RoomView[];
  meals: MealView[];
  baths: BathView[];
  amenityGroups: AmenityGroupView[]; // 語彙の中カテゴリの順
  internet: InternetView | null;
  pets: PetsView | null;
  conditions: ConditionsView | null;
  parking: ParkingView | null;
  access: AccessView | null;
  surroundings: SurroundingsView | null;
  cautions: string[];
  licenses: { label: string; number: string | null }[];
  bookingLinks: { label: string; url: string; isOfficial: boolean }[];
  sources: { name: string; url: string; typeLabel: string; retrievedAt: string; fields: string[] }[];
};

export type AccommodationViewInput = {
  details: unknown;
  checkIn: string | null;
  checkOut: string | null;
  officialUrl: string | null;
  photos: { photo: Photo; subjectKey: string | null }[];
  locale: Locale;
};

// 許可・届出の種類（details.ts の LICENSE_KINDS と同じ並び）
const LICENSE_KIND_LIST: readonly Term[] = [
  { code: "ryokan_business", label: "旅館・ホテル営業" },
  { code: "minpaku", label: "住宅宿泊事業（民泊）" },
  { code: "special_zone_minpaku", label: "特区民泊" },
  { code: "simple_lodging", label: "簡易宿所営業" },
];

// ---- 小道具 ----

const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
const labelOrNull = (list: readonly Term[], code: string | undefined) => (code === undefined ? null : labelOf(list, code));

/** DB の time（"HH:MM:SS"）も "HH:MM" にする */
export function toHHMM(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{2}:\d{2})/.exec(v);
  return m ? m[1] : null;
}

const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** 「550 円」「12.5 USD」。税込なら「（税込）」、税別なら「（税別）」を足す */
export function formatMoney(m: { amount: number; amountMax?: number; currency: string; taxIncluded?: boolean }): string {
  const amount = m.amountMax !== undefined && m.amountMax !== m.amount ? `${num(m.amount)}〜${num(m.amountMax)}` : num(m.amount);
  const unit = m.currency === "JPY" ? "円" : m.currency;
  const tax = m.taxIncluded === true ? "（税込）" : m.taxIncluded === false ? "（税別）" : "";
  return `${amount} ${unit}${tax}`;
}

const money = (m: Money | undefined) => (m ? formatMoney({ amount: m.amount, currency: m.currency, taxIncluded: m.tax_included }) : null);

/** 「15:00〜24:00」。片方だけでも出す */
function range(from: string | undefined, to: string | undefined): string | null {
  if (from === undefined && to === undefined) return null;
  return `${from ?? ""}〜${to ?? ""}`;
}

/** 「2〜8」。同じなら「2」 */
function guestsText(min: number | undefined, max: number | undefined): string | null {
  if (min === undefined && max === undefined) return null;
  if (min === undefined || max === undefined || min === max) return String(min ?? max);
  return `${min}〜${max}`;
}

/** 「6〜12 歳」「6 歳以上」「12 歳以下」 */
function ageText(min: number | undefined, max: number | undefined): string | null {
  if (min !== undefined && max !== undefined) return min === max ? `${min} 歳` : `${min}〜${max} 歳`;
  if (min !== undefined) return `${min} 歳以上`;
  if (max !== undefined) return `${max} 歳以下`;
  return null;
}

// ---- 組み立て ----

/** details を画面の形にする。details が無いか形が違えば null（呼び出し側は facts を出す） */
export function toAccommodationView(input: AccommodationViewInput): AccommodationView | null {
  if (input.details === null || input.details === undefined) return null;
  const parsed = accommodationDetailsSchema.safeParse(input.details);
  if (!parsed.success) return null;
  const d: AccommodationDetails = parsed.data;
  const text = (t: LocalizedText | undefined) => (t ? resolveLocalizedText(t, input.locale).text || null : null);
  const rooms = d.rooms ?? [];
  const roomLabel = (key: string | null) => {
    const room = rooms.find((r) => r.key === key);
    const name = text(room?.name);
    if (name) return name;
    return rooms.length <= 1 ? "1 棟" : (key ?? "1 棟");
  };

  return {
    stay: { checkIn: toHHMM(input.checkIn), checkOut: toHHMM(input.checkOut) },
    priceTable: priceTable(d, roomLabel, input.officialUrl),
    rooms: rooms.map((r) => ({
      key: r.key,
      label: roomLabel(r.key),
      capacity: orNull(r.capacity),
      areaSqm: orNull(r.area_sqm),
      tatami: orNull(r.tatami),
      styleLabel: labelOrNull(ROOM_STYLE_LIST, r.style),
      view: text(r.view),
      smokingLabel: labelOrNull(SMOKING_LIST, r.smoking),
      bedrooms: (r.bedrooms ?? []).map((b, i) => {
        const name = text(b.name);
        return {
          label: `寝室 ${i + 1}${name ? `（${name}）` : ""}`,
          beds: b.beds.map((x) => `${labelOf(BED_TYPE_LIST, x.type)} ${x.count}`).join("・"),
        };
      }),
      photos: input.photos.filter((p) => p.subjectKey === r.key).map((p) => p.photo),
    })),
    meals: (d.meals ?? []).map((m) => ({
      label: labelOf(MEAL_LIST, m.meal),
      offered: m.offered,
      styleLabel: labelOrNull(MEAL_STYLE_LIST, m.style),
      placeLabel: labelOrNull(MEAL_PLACE_LIST, m.place),
      hours: range(m.served_from, m.served_to),
      slots: m.slots ?? [],
      fee: money(m.fee),
      allergyConsult: orNull(m.allergy_consult),
      selfCook: orNull(m.self_cook),
      note: text(m.note),
    })),
    baths: (d.baths ?? []).map((b) => ({
      label: labelOf(BATH_KIND_LIST, b.kind),
      saunaStyleLabel: labelOrNull(SAUNA_STYLE_LIST, b.sauna_style),
      hotSpring: orNull(b.hot_spring),
      spring: orNull(b.spring),
      sourceLabel: labelOrNull(HOT_SPRING_SOURCE_LIST, b.source),
      capacity: orNull(b.capacity),
      coldBath: orNull(b.cold_bath),
      outdoorRest: orNull(b.outdoor_rest),
      hours: range(b.open_from, b.open_to),
      genderLabel: labelOrNull(BATH_GENDER_LIST, b.gender),
      reservation: b.reservation
        ? [
            b.reservation.required ? "要予約" : "予約不要",
            labelOrNull(RESERVATION_TIMING_LIST, b.reservation.when),
            b.reservation.slot_minutes !== undefined ? `${b.reservation.slot_minutes} 分` : null,
          ]
            .filter(Boolean)
            .join("・")
        : null,
      fee: money(b.fee),
      note: text(b.note),
    })),
    amenityGroups: amenityGroups(d, text),
    internet: d.internet
      ? {
          wifi: orNull(d.internet.wifi),
          downMbps: orNull(d.internet.down_mbps),
          upMbps: orNull(d.internet.up_mbps),
          measuredAt: orNull(d.internet.measured_at),
          deskLabel: labelOrNull(DESK_SCOPE_LIST, d.internet.desk),
          note: text(d.internet.note),
        }
      : null,
    pets: d.pets
      ? { allowed: d.pets.allowed, sizeLabel: labelOrNull(PET_SIZE_LIST, d.pets.size), fee: money(d.pets.fee), note: text(d.pets.note) }
      : null,
    conditions: d.rules
      ? {
          smokingLabel: labelOrNull(SMOKING_LIST, d.rules.smoking),
          parties: orNull(d.rules.parties),
          fireworks: orNull(d.rules.fireworks),
          quietHours: range(d.rules.quiet_from, d.rules.quiet_to),
          bbqUntil: orNull(d.rules.bbq_until),
          minNights: orNull(d.rules.min_nights),
          garbage: text(d.rules.garbage),
          note: text(d.rules.note),
        }
      : null,
    parking: d.parking
      ? {
          placeLabel: labelOrNull(PARKING_PLACE_LIST, d.parking.place),
          spaces: orNull(d.parking.spaces),
          maxHeightM: orNull(d.parking.max_height_m),
          fee: money(d.parking.fee),
          note: text(d.parking.note),
        }
      : null,
    access: d.access
      ? {
          station: text(d.access.station),
          modeLabel: labelOrNull(ACCESS_MODE_LIST, d.access.mode),
          minutes: orNull(d.access.minutes),
          shuttle: orNull(d.access.shuttle),
          slopeOrStairs: orNull(d.access.slope_or_stairs),
          needsCar: orNull(d.access.needs_car),
          winterRestriction: text(d.access.winter_restriction),
          route: text(d.access.route),
        }
      : null,
    surroundings: d.surroundings
      ? {
          neighborDistanceM: orNull(d.surroundings.neighbor_distance_m),
          sightlines: text(d.surroundings.sightlines),
          noiseSources: text(d.surroundings.noise_sources),
          view: text(d.surroundings.view),
          elevationM: orNull(d.surroundings.elevation_m),
        }
      : null,
    cautions: (d.cautions ?? []).flatMap((c) => {
      const t = text(c.note);
      return t ? [t] : [];
    }),
    licenses: (d.licenses ?? []).map((l) => ({ label: labelOf(LICENSE_KIND_LIST, l.kind), number: orNull(l.number) })),
    bookingLinks: (d.booking_links ?? []).map((b) => ({ label: b.label, url: b.url, isOfficial: b.is_official ?? false })),
    sources: (d.sources ?? []).map((s) => ({
      name: s.name,
      url: s.url,
      typeLabel: labelOf(SOURCE_TYPE_LIST, s.type),
      retrievedAt: s.retrieved_at,
      fields: s.fields ?? [],
    })),
  };
}

/** 料金（参考）の表。部屋ごとの最小〜最大だけ。区分ごとの値は出さない */
function priceTable(d: AccommodationDetails, roomLabel: (key: string | null) => string, officialUrl: string | null): PriceTable | null {
  const hint = priceHint({ rooms: d.rooms, prices: d.prices });
  if (!hint) return null;
  return {
    unitLabel: hint.per && hint.currency ? unitText(hint.per, hint.currency, hint.taxIncluded) : null,
    perLabel: hint.per ? labelOf(PRICE_PER_LIST, hint.per) : null,
    currency: hint.currency,
    taxIncluded: hint.taxIncluded,
    rows: hint.rows.map((r) => {
      const row: PriceTableRow = {
        roomLabel: roomLabel(r.room),
        guests: guestsText(r.guestsMin, r.guestsMax),
        min: r.min,
        max: r.max,
        mealsLabels: r.meals.map((m) => labelOf(PRICE_MEALS_LIST, m)),
      };
      if (r.per !== hint.per || r.currency !== hint.currency) row.unitLabel = unitText(r.per, r.currency, r.taxIncluded);
      const note = [
        ...r.who.map(whoText),
        ...r.includes.map((k) => `${labelOf(PRICE_KIND_LIST, k)}込み`),
        ...r.includesSome.map((k) => `${labelOf(PRICE_KIND_LIST, k)}込み（一部）`),
      ].join("・");
      if (note) row.note = note;
      return row;
    }),
    fees: hint.fees.map((it): LabeledText => {
      const label = labelOf(PRICE_KIND_LIST, it.kind);
      const text = priceText(it, roomLabel);
      return it.includedInRoom ? { label, text: `${text}（宿泊料に込み）`, includedInRoom: true } : { label, text };
    }),
    children: hint.children.map((it) => ({ label: labelOf(PRICE_AUDIENCE_LIST, "child"), text: priceText(it, roomLabel) })),
    officialUrl,
  };
}

/** 「1 棟 1 泊・税込（円）」 */
function unitText(per: string, currency: string, taxIncluded: boolean | null): string {
  const unit = currency === "JPY" ? "円" : currency;
  const tax = taxIncluded === true ? "・税込" : taxIncluded === false ? "・税別" : "";
  return `${labelOf(PRICE_PER_LIST, per)}${tax}（${unit}）`;
}

/** 「大人」「6〜12 歳」「大人 13 歳以上」 */
function whoText(w: PriceWho): string {
  const who = w.audience !== undefined && w.audience !== "all" ? labelOf(PRICE_AUDIENCE_LIST, w.audience) : null;
  return [who, ageText(w.age_min, w.age_max)].filter(Boolean).join(" ");
}

/** 料金 1 件の文。「ツイン 3〜4 名のとき 1 回の滞在 1,000〜2,000 円」「6〜12 歳 50〜70%」「大人 1 名 1 泊 150 円（税込）・入湯税込み」 */
function priceText(it: PriceLine, roomLabel: (key: string | null) => string): string {
  const room = it.room !== undefined ? roomLabel(it.room) : null;
  const guests = guestsText(it.guests_min, it.guests_max);
  // 子どもの料金は見出しが「子ども」なので、年齢だけ出す
  const who = it.kind === "room" ? ageText(it.age_min, it.age_max) : whoText(it);
  const meals = it.meals ? labelOf(PRICE_MEALS_LIST, it.meals) : null;
  const value =
    it.amount !== undefined
      ? `${labelOf(PRICE_PER_LIST, it.per)} ${formatMoney({ amount: it.amount, amountMax: it.amount_max, currency: it.currency, taxIncluded: it.tax_included })}`
      : it.rate_percent_max !== undefined
        ? `${it.rate_percent}〜${it.rate_percent_max}%`
        : `${it.rate_percent}%`;
  const text = [room, guests ? `${guests} 名のとき` : null, who || null, meals, value].filter(Boolean).join(" ");
  const includes = (it.includes ?? []).map((k) => `${labelOf(PRICE_KIND_LIST, k)}込み`);
  return [text, ...includes].join("・");
}

/** 設備を中カテゴリにまとめる。中カテゴリも中身も語彙の順 */
function amenityGroups(d: AccommodationDetails, text: (t: LocalizedText | undefined) => string | null): AmenityGroupView[] {
  const entries = d.amenities ?? [];
  const order = (code: string) => AMENITY_LIST.findIndex((a) => a.code === code);
  return AMENITY_GROUP_LIST.flatMap((g) => {
    const items = entries
      .filter((a) => amenityGroupOf(a.code)?.code === g.code)
      .sort((a, b) => order(a.code) - order(b.code))
      .map((a) => ({
        label: labelOf(AMENITY_LIST, a.code),
        options: (a.options ?? []).map((o) => labelOf(amenityOptions(a.code), o)),
        count: orNull(a.count),
        paid: orNull(a.paid),
        note: text(a.note),
      }));
    return items.length ? [{ label: g.label, items }] : [];
  });
}
