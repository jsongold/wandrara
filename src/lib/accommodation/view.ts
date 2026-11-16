// 宿の詳細の画面に出す形。details（jsonb）を、ラベルと文字にしてから渡す。画面は並べるだけ
import { resolveLocalizedText } from "../feed.ts";
import { messages, type Messages } from "../i18n/messages.ts";
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
  { code: "ryokan_business", label: "旅館・ホテル営業", en: "Ryokan or hotel business" },
  { code: "minpaku", label: "住宅宿泊事業（民泊）", en: "Private lodging (minpaku)" },
  { code: "special_zone_minpaku", label: "特区民泊", en: "Special-zone private lodging" },
  { code: "simple_lodging", label: "簡易宿所営業", en: "Simple lodging business" },
];

// ---- 小道具 ----

const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
const labelOrNull = (list: readonly Term[], code: string | undefined, locale: Locale) =>
  code === undefined ? null : labelOf(list, code, locale);

/** DB の time（"HH:MM:SS"）も "HH:MM" にする */
export function toHHMM(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{2}:\d{2})/.exec(v);
  return m ? m[1] : null;
}

export const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

type Text = Messages["accommodation"];
type MoneyInput = { amount: number; amountMax?: number; currency: string; taxIncluded?: boolean };

/** 金額だけ（税の注記なし）。ja「1,000〜2,000 円」、en「¥1,000–2,000」。円でなければ「12.5 USD」 */
export function amountText(m: MoneyInput, locale: Locale): string {
  const t = messages(locale).accommodation;
  const amount = m.amountMax !== undefined && m.amountMax !== m.amount ? t.range(num(m.amount), num(m.amountMax)) : num(m.amount);
  return m.currency === "JPY" ? t.price.yen(amount) : `${amount} ${m.currency}`;
}

/** 税込なら「（税込）」、税別なら「（税別）」。分からなければ空 */
function taxText(taxIncluded: boolean | undefined, locale: Locale): string {
  const t = messages(locale).accommodation.price;
  return taxIncluded === true ? t.taxIn : taxIncluded === false ? t.taxOut : "";
}

/** 「550 円」「12.5 USD」。税込なら「（税込）」、税別なら「（税別）」を足す。en は「¥550 (tax incl.)」 */
export function formatMoney(m: MoneyInput, locale: Locale = "ja"): string {
  return amountText(m, locale) + taxText(m.taxIncluded, locale);
}

/** 「15:00〜24:00」。片方だけでも出す */
function range(t: Text, from: string | undefined, to: string | undefined): string | null {
  if (from === undefined && to === undefined) return null;
  return t.range(from ?? "", to ?? "");
}

/** 「2〜8」。同じなら「2」 */
function guestsText(t: Text, min: number | undefined, max: number | undefined): string | null {
  if (min === undefined && max === undefined) return null;
  if (min === undefined || max === undefined || min === max) return String(min ?? max);
  return t.range(String(min), String(max));
}

/** 「6〜12 歳」「6 歳以上」「12 歳以下」 */
function ageText(t: Text, min: number | undefined, max: number | undefined): string | null {
  if (min !== undefined && max !== undefined) return min === max ? t.price.age(min) : t.price.ages(t.range(String(min), String(max)));
  if (min !== undefined) return t.price.ageMin(min);
  if (max !== undefined) return t.price.ageMax(max);
  return null;
}

// ---- 組み立て ----

/** details を画面の形にする。details が無いか形が違えば null（呼び出し側は facts を出す） */
export function toAccommodationView(input: AccommodationViewInput): AccommodationView | null {
  if (input.details === null || input.details === undefined) return null;
  const parsed = accommodationDetailsSchema.safeParse(input.details);
  if (!parsed.success) return null;
  const d: AccommodationDetails = parsed.data;
  const locale = input.locale;
  const t = messages(locale).accommodation;
  const label = (list: readonly Term[], code: string) => labelOf(list, code, locale);
  const labelOrNone = (list: readonly Term[], code: string | undefined) => labelOrNull(list, code, locale);
  const money = (m: Money | undefined) => (m ? formatMoney({ amount: m.amount, currency: m.currency, taxIncluded: m.tax_included }, locale) : null);
  const text = (x: LocalizedText | undefined) => (x ? resolveLocalizedText(x, locale).text || null : null);
  const rooms = d.rooms ?? [];
  const roomLabel = (key: string | null) => {
    const room = rooms.find((r) => r.key === key);
    const name = text(room?.name);
    if (name) return name;
    return rooms.length <= 1 ? t.price.wholeHouse : (key ?? t.price.wholeHouse);
  };

  return {
    stay: { checkIn: toHHMM(input.checkIn), checkOut: toHHMM(input.checkOut) },
    priceTable: priceTable(d, roomLabel, input.officialUrl, locale),
    rooms: rooms.map((r) => ({
      key: r.key,
      label: roomLabel(r.key),
      capacity: orNull(r.capacity),
      areaSqm: orNull(r.area_sqm),
      tatami: orNull(r.tatami),
      styleLabel: labelOrNone(ROOM_STYLE_LIST, r.style),
      view: text(r.view),
      smokingLabel: labelOrNone(SMOKING_LIST, r.smoking),
      bedrooms: (r.bedrooms ?? []).map((b, i) => {
        const name = text(b.name);
        return {
          label: `${t.room.bedroom(i + 1)}${name ? t.paren(name) : ""}`,
          beds: b.beds.map((x) => t.room.bed(label(BED_TYPE_LIST, x.type), x.count)).join(t.sep),
        };
      }),
      photos: input.photos.filter((p) => p.subjectKey === r.key).map((p) => p.photo),
    })),
    meals: (d.meals ?? []).map((m) => ({
      label: label(MEAL_LIST, m.meal),
      offered: m.offered,
      styleLabel: labelOrNone(MEAL_STYLE_LIST, m.style),
      placeLabel: labelOrNone(MEAL_PLACE_LIST, m.place),
      hours: range(t, m.served_from, m.served_to),
      slots: m.slots ?? [],
      fee: money(m.fee),
      allergyConsult: orNull(m.allergy_consult),
      selfCook: orNull(m.self_cook),
      note: text(m.note),
    })),
    baths: (d.baths ?? []).map((b) => ({
      label: label(BATH_KIND_LIST, b.kind),
      saunaStyleLabel: labelOrNone(SAUNA_STYLE_LIST, b.sauna_style),
      hotSpring: orNull(b.hot_spring),
      spring: orNull(b.spring),
      sourceLabel: labelOrNone(HOT_SPRING_SOURCE_LIST, b.source),
      capacity: orNull(b.capacity),
      coldBath: orNull(b.cold_bath),
      outdoorRest: orNull(b.outdoor_rest),
      hours: range(t, b.open_from, b.open_to),
      genderLabel: labelOrNone(BATH_GENDER_LIST, b.gender),
      reservation: b.reservation
        ? [
            b.reservation.required ? t.bath.required : t.bath.notRequired,
            labelOrNone(RESERVATION_TIMING_LIST, b.reservation.when),
            b.reservation.slot_minutes !== undefined ? t.bath.minutes(b.reservation.slot_minutes) : null,
          ]
            .filter(Boolean)
            .join(t.sep)
        : null,
      fee: money(b.fee),
      note: text(b.note),
    })),
    amenityGroups: amenityGroups(d, text, locale),
    internet: d.internet
      ? {
          wifi: orNull(d.internet.wifi),
          downMbps: orNull(d.internet.down_mbps),
          upMbps: orNull(d.internet.up_mbps),
          measuredAt: orNull(d.internet.measured_at),
          deskLabel: labelOrNone(DESK_SCOPE_LIST, d.internet.desk),
          note: text(d.internet.note),
        }
      : null,
    pets: d.pets
      ? { allowed: d.pets.allowed, sizeLabel: labelOrNone(PET_SIZE_LIST, d.pets.size), fee: money(d.pets.fee), note: text(d.pets.note) }
      : null,
    conditions: d.rules
      ? {
          smokingLabel: labelOrNone(SMOKING_LIST, d.rules.smoking),
          parties: orNull(d.rules.parties),
          fireworks: orNull(d.rules.fireworks),
          quietHours: range(t, d.rules.quiet_from, d.rules.quiet_to),
          bbqUntil: orNull(d.rules.bbq_until),
          minNights: orNull(d.rules.min_nights),
          garbage: text(d.rules.garbage),
          note: text(d.rules.note),
        }
      : null,
    parking: d.parking
      ? {
          placeLabel: labelOrNone(PARKING_PLACE_LIST, d.parking.place),
          spaces: orNull(d.parking.spaces),
          maxHeightM: orNull(d.parking.max_height_m),
          fee: money(d.parking.fee),
          note: text(d.parking.note),
        }
      : null,
    access: d.access
      ? {
          station: text(d.access.station),
          modeLabel: labelOrNone(ACCESS_MODE_LIST, d.access.mode),
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
      const x = text(c.note);
      return x ? [x] : [];
    }),
    licenses: (d.licenses ?? []).map((l) => ({ label: label(LICENSE_KIND_LIST, l.kind), number: orNull(l.number) })),
    bookingLinks: (d.booking_links ?? []).map((b) => ({ label: b.label, url: b.url, isOfficial: b.is_official ?? false })),
    // 出典の fields（details や core の欄の名前）は画面の言葉にする。知らない名前はそのまま出す
    sources: (d.sources ?? []).map((s) => ({
      name: s.name,
      url: s.url,
      typeLabel: label(SOURCE_TYPE_LIST, s.type),
      retrievedAt: s.retrieved_at,
      fields: (s.fields ?? []).map((f) => t.fields[f] ?? f),
    })),
  };
}

/** 料金（参考）の表。部屋ごとの最小〜最大だけ。区分ごとの値は出さない */
function priceTable(
  d: AccommodationDetails,
  roomLabel: (key: string | null) => string,
  officialUrl: string | null,
  locale: Locale,
): PriceTable | null {
  const hint = priceHint({ rooms: d.rooms, prices: d.prices });
  if (!hint) return null;
  const t = messages(locale).accommodation;
  const label = (list: readonly Term[], code: string) => labelOf(list, code, locale);
  return {
    unitLabel: hint.per && hint.currency ? unitText(hint.per, hint.currency, hint.taxIncluded, locale) : null,
    perLabel: hint.per ? label(PRICE_PER_LIST, hint.per) : null,
    currency: hint.currency,
    taxIncluded: hint.taxIncluded,
    rows: hint.rows.map((r) => {
      const row: PriceTableRow = {
        roomLabel: roomLabel(r.room),
        guests: guestsText(t, r.guestsMin, r.guestsMax),
        min: r.min,
        max: r.max,
        mealsLabels: r.meals.map((m) => label(PRICE_MEALS_LIST, m)),
      };
      if (r.per !== hint.per || r.currency !== hint.currency) row.unitLabel = unitText(r.per, r.currency, r.taxIncluded, locale);
      const note = [
        ...r.who.map((w) => whoText(w, locale)),
        ...r.includes.map((k) => t.price.includes(label(PRICE_KIND_LIST, k))),
        ...r.includesSome.map((k) => t.price.includesSome(label(PRICE_KIND_LIST, k))),
      ].join(t.sep);
      if (note) row.note = note;
      return row;
    }),
    fees: hint.fees.map((it): LabeledText => {
      const kind = label(PRICE_KIND_LIST, it.kind);
      const text = priceText(it, roomLabel, locale);
      return it.includedInRoom ? { label: kind, text: `${text}${t.price.inRoom}`, includedInRoom: true } : { label: kind, text };
    }),
    children: hint.children.map((it) => ({ label: label(PRICE_AUDIENCE_LIST, "child"), text: priceText(it, roomLabel, locale) })),
    officialUrl,
  };
}

/** 「1 棟 1 泊・税込（円）」。en は「Per house per night · tax incl. (¥)」 */
function unitText(per: string, currency: string, taxIncluded: boolean | null, locale: Locale): string {
  const t = messages(locale).accommodation;
  const unit = currency === "JPY" ? t.price.yenUnit : currency;
  const tax = taxIncluded === true ? t.price.unitTaxIn : taxIncluded === false ? t.price.unitTaxOut : "";
  return `${capitalize(labelOf(PRICE_PER_LIST, per, locale))}${tax}${t.paren(unit)}`;
}

// en の単位（per house per night）は文頭だけ大文字にする。ja は変わらない
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** 「大人」「6〜12 歳」「大人 13 歳以上」 */
function whoText(w: PriceWho, locale: Locale): string {
  const t = messages(locale).accommodation;
  const who = w.audience !== undefined && w.audience !== "all" ? labelOf(PRICE_AUDIENCE_LIST, w.audience, locale) : null;
  return [who, ageText(t, w.age_min, w.age_max)].filter(Boolean).join(" ");
}

/** 料金 1 件の文。「ツイン 3〜4 名のとき 1 回の滞在 1,000〜2,000 円」「6〜12 歳 50〜70%」「大人 1 名 1 泊 150 円（税込）・入湯税込み」 */
function priceText(it: PriceLine, roomLabel: (key: string | null) => string, locale: Locale): string {
  const t = messages(locale).accommodation;
  const room = it.room !== undefined ? roomLabel(it.room) : null;
  const guests = guestsText(t, it.guests_min, it.guests_max);
  // 子どもの料金は見出しが「子ども」なので、年齢だけ出す
  const who = it.kind === "room" ? ageText(t, it.age_min, it.age_max) : whoText(it, locale);
  const meals = it.meals ? labelOf(PRICE_MEALS_LIST, it.meals, locale) : null;
  const value =
    it.amount !== undefined
      ? t.price.perPrice(
          labelOf(PRICE_PER_LIST, it.per, locale),
          amountText({ amount: it.amount, amountMax: it.amount_max, currency: it.currency }, locale),
        ) + taxText(it.tax_included, locale)
      : it.rate_percent_max !== undefined
        ? `${t.range(String(it.rate_percent), String(it.rate_percent_max))}%`
        : `${it.rate_percent}%`;
  const text = [room, guests ? t.price.forGuests(guests) : null, who || null, meals, value].filter(Boolean).join(t.price.partSep);
  const includes = (it.includes ?? []).map((k) => t.price.includes(labelOf(PRICE_KIND_LIST, k, locale)));
  return [text, ...includes].join(t.sep);
}

/** 設備を中カテゴリにまとめる。中カテゴリも中身も語彙の順 */
function amenityGroups(d: AccommodationDetails, text: (t: LocalizedText | undefined) => string | null, locale: Locale): AmenityGroupView[] {
  const entries = d.amenities ?? [];
  const order = (code: string) => AMENITY_LIST.findIndex((a) => a.code === code);
  return AMENITY_GROUP_LIST.flatMap((g) => {
    const items = entries
      .filter((a) => amenityGroupOf(a.code)?.code === g.code)
      .sort((a, b) => order(a.code) - order(b.code))
      .map((a) => ({
        label: labelOf(AMENITY_LIST, a.code, locale),
        options: (a.options ?? []).map((o) => labelOf(amenityOptions(a.code), o, locale)),
        count: orNull(a.count),
        paid: orNull(a.paid),
        note: text(a.note),
      }));
    return items.length ? [{ label: locale === "en" ? g.en : g.label, items }] : [];
  });
}
