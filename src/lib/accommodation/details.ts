// 宿の details（jsonb）の形。prices は prices.ts。必須かどうかは quality.ts が決める
import { z } from "zod";
import {
  ACCESS_MODES,
  AMENITIES,
  amenityOptions,
  BATH_GENDERS,
  BATH_KINDS,
  BED_TYPES,
  DESK_SCOPES,
  HOT_SPRING_SOURCES,
  MEAL_PLACES,
  MEAL_STYLES,
  MEALS,
  PARKING_PLACES,
  PET_SIZES,
  RESERVATION_TIMINGS,
  ROOM_STYLES,
  SAUNA_STYLES,
  SMOKINGS,
  SOURCE_TYPES,
} from "../vocab/accommodation.ts";
import { localizedTextSchema } from "../i18n/localized.ts";

// ---- 共通の値 ----

// LocalizedText（{ ja: "...", en: "..." }）は src/lib/i18n/localized.ts

// "HH:MM"（00:00〜23:59）
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻は HH:MM（00:00〜23:59）");

// "YYYY-MM-DD"（実在する日）
export const dateSchema = z.iso.date("日付は YYYY-MM-DD");

export const currencySchema = z.string().regex(/^[A-Z]{3}$/, "通貨は ISO 4217 の 3 文字（JPY など）");

const urlSchema = z.url({ protocol: /^https?$/, error: "URL は http(s)" });
const nonneg = z.number().nonnegative();
const count = z.number().int().nonnegative();

export const moneySchema = z.strictObject({
  amount: nonneg,
  currency: currencySchema,
  tax_included: z.boolean().optional(),
});

// ---- 部屋 ----

export const roomKeySchema = z.string().regex(/^[a-z0-9_-]{1,40}$/, "部屋の key は英小文字・数字・_・- の 1〜40 文字");

const bedSchema = z.strictObject({ type: z.enum(BED_TYPES), count: z.number().int().positive() });

const bedroomSchema = z.strictObject({
  name: localizedTextSchema.optional(),
  beds: z.array(bedSchema),
});

export const roomSchema = z.strictObject({
  key: roomKeySchema,
  name: localizedTextSchema.optional(),
  capacity: z.number().int().positive().optional(),
  area_sqm: nonneg.optional(),
  tatami: nonneg.optional(),
  style: z.enum(ROOM_STYLES).optional(),
  view: localizedTextSchema.optional(),
  smoking: z.enum(SMOKINGS).optional(),
  bedrooms: z.array(bedroomSchema).optional(),
});

// ---- 風呂 ----

const reservationSchema = z.strictObject({
  required: z.boolean(),
  when: z.enum(RESERVATION_TIMINGS).optional(),
  slot_minutes: z.number().int().positive().optional(),
});

export const bathSchema = z
  .strictObject({
    kind: z.enum(BATH_KINDS),
    sauna_style: z.enum(SAUNA_STYLES).optional(),
    hot_spring: z.boolean().optional(),
    spring: z.string().optional(),
    source: z.enum(HOT_SPRING_SOURCES).optional(),
    capacity: z.number().int().positive().optional(),
    cold_bath: z.boolean().optional(),
    outdoor_rest: z.boolean().optional(),
    open_from: timeSchema.optional(),
    open_to: timeSchema.optional(),
    gender: z.enum(BATH_GENDERS).optional(),
    reservation: reservationSchema.optional(),
    fee: moneySchema.optional(),
    note: localizedTextSchema.optional(),
  })
  .superRefine((b, ctx) => {
    // sauna_style はサウナのときだけ
    if (b.sauna_style !== undefined && b.kind !== "sauna") {
      ctx.addIssue({ code: "custom", path: ["sauna_style"], message: `sauna_style は kind=sauna のときだけ書ける（kind=${b.kind}）` });
    }
  });

// ---- 食事 ----

export const mealSchema = z.strictObject({
  meal: z.enum(MEALS),
  offered: z.boolean(),
  style: z.enum(MEAL_STYLES).optional(),
  place: z.enum(MEAL_PLACES).optional(),
  served_from: timeSchema.optional(),
  served_to: timeSchema.optional(),
  slots: z.array(timeSchema).optional(),
  fee: moneySchema.optional(),
  allergy_consult: z.boolean().optional(),
  self_cook: z.boolean().optional(),
  note: localizedTextSchema.optional(),
});

// ---- 設備 ----

export const amenitySchema = z
  .strictObject({
    code: z.enum(AMENITIES),
    options: z.array(z.string()).optional(),
    count: z.number().int().positive().optional(),
    paid: z.boolean().optional(),
    note: localizedTextSchema.optional(),
  })
  .superRefine((a, ctx) => {
    // options は設備ごとに決まった値だけ
    const allowed = amenityOptions(a.code).map((o) => o.code);
    (a.options ?? []).forEach((o, i) => {
      if (!allowed.includes(o)) {
        const list = allowed.length ? allowed.join(", ") : "なし";
        ctx.addIssue({ code: "custom", path: ["options", i], message: `${a.code} に付けられない option: ${o}（使える値: ${list}）` });
      }
    });
  });

// ---- そのほか ----

export const internetSchema = z.strictObject({
  wifi: z.boolean().optional(),
  down_mbps: nonneg.optional(),
  up_mbps: nonneg.optional(),
  measured_at: dateSchema.optional(),
  desk: z.enum(DESK_SCOPES).optional(),
  note: localizedTextSchema.optional(),
});

export const petsSchema = z.strictObject({
  allowed: z.boolean(),
  size: z.enum(PET_SIZES).optional(),
  fee: moneySchema.optional(),
  note: localizedTextSchema.optional(),
});

export const rulesSchema = z.strictObject({
  smoking: z.enum(SMOKINGS).optional(),
  parties: z.boolean().optional(),
  fireworks: z.boolean().optional(),
  quiet_from: timeSchema.optional(),
  quiet_to: timeSchema.optional(),
  bbq_until: timeSchema.optional(),
  min_nights: z.number().int().positive().optional(),
  garbage: localizedTextSchema.optional(),
  note: localizedTextSchema.optional(),
});

export const parkingSchema = z.strictObject({
  place: z.enum(PARKING_PLACES).optional(),
  spaces: count.optional(),
  max_height_m: nonneg.optional(),
  fee: moneySchema.optional(),
  note: localizedTextSchema.optional(),
});

export const accessSchema = z.strictObject({
  station: localizedTextSchema.optional(),
  mode: z.enum(ACCESS_MODES).optional(),
  minutes: count.optional(),
  shuttle: z.boolean().optional(),
  slope_or_stairs: z.boolean().optional(),
  needs_car: z.boolean().optional(),
  winter_restriction: localizedTextSchema.optional(),
  route: localizedTextSchema.optional(),
});

export const surroundingsSchema = z.strictObject({
  neighbor_distance_m: nonneg.optional(),
  sightlines: localizedTextSchema.optional(),
  noise_sources: localizedTextSchema.optional(),
  view: localizedTextSchema.optional(),
  // 海抜。0 未満もありうるので nonnegative にしない
  elevation_m: z.number().optional(),
});

export const cautionSchema = z.strictObject({ note: localizedTextSchema });

// 旧 accommodation_licenses と同じ値
export const LICENSE_KINDS = ["ryokan_business", "minpaku", "special_zone_minpaku", "simple_lodging"] as const;

export const licenseSchema = z.strictObject({
  kind: z.enum(LICENSE_KINDS),
  number: z.string().optional(),
});

export const bookingLinkSchema = z.strictObject({
  label: z.string().min(1),
  url: urlSchema,
  is_official: z.boolean().optional(),
});

export const sourceSchema = z.strictObject({
  name: z.string().min(1),
  url: urlSchema,
  type: z.enum(SOURCE_TYPES),
  retrieved_at: dateSchema,
  fields: z.array(z.string()).optional(),
});

// ---- 全体（prices を除く）----

export const detailsBaseSchema = z
  .strictObject({
    rooms: z.array(roomSchema).optional(),
    baths: z.array(bathSchema).optional(),
    meals: z.array(mealSchema).optional(),
    amenities: z.array(amenitySchema).optional(),
    internet: internetSchema.optional(),
    pets: petsSchema.optional(),
    rules: rulesSchema.optional(),
    parking: parkingSchema.optional(),
    access: accessSchema.optional(),
    surroundings: surroundingsSchema.optional(),
    cautions: z.array(cautionSchema).optional(),
    licenses: z.array(licenseSchema).optional(),
    booking_links: z.array(bookingLinkSchema).optional(),
    sources: z.array(sourceSchema).optional(),
  })
  .superRefine((d, ctx) => {
    // rooms[].key は dest の中で一意
    const seen = new Set<string>();
    (d.rooms ?? []).forEach((r, i) => {
      if (seen.has(r.key)) ctx.addIssue({ code: "custom", path: ["rooms", i, "key"], message: `部屋の key が重なっている: ${r.key}` });
      seen.add(r.key);
    });
  });

export type Money = z.infer<typeof moneySchema>;
export type Room = z.infer<typeof roomSchema>;
export type Bath = z.infer<typeof bathSchema>;
export type Meal = z.infer<typeof mealSchema>;
export type AmenityEntry = z.infer<typeof amenitySchema>;
export type Internet = z.infer<typeof internetSchema>;
export type Pets = z.infer<typeof petsSchema>;
export type Rules = z.infer<typeof rulesSchema>;
export type Parking = z.infer<typeof parkingSchema>;
export type Access = z.infer<typeof accessSchema>;
export type Surroundings = z.infer<typeof surroundingsSchema>;
export type Caution = z.infer<typeof cautionSchema>;
export type License = z.infer<typeof licenseSchema>;
export type BookingLink = z.infer<typeof bookingLinkSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type DetailsBase = z.infer<typeof detailsBaseSchema>;
