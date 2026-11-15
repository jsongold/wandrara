// コア accommodation（宿）の表と詳細。units → bedrooms → beds が入れ子。baths・prices・amenities の unit_id は部屋のものを指す（null は宿全体）
import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, time, uuid } from "drizzle-orm/pg-core";
import {
  currencyCheck,
  destChildColumns,
  geoPrecisionCheck,
  langCheck,
  localized,
  locationColumns,
  oneOf,
  publishedRead,
  textsColumns,
  type CoreDef,
} from "./_shared.ts";
import { accommodationDetailsSchema } from "../../lib/accommodation/schema.ts";
import { destinations } from "./common.ts";
import { operators } from "./people.ts";

const KIND_LABELS = {
  hotel: "ホテル",
  ryokan: "旅館",
  private_rental: "一棟貸し",
  minshuku: "民宿",
  pension: "ペンション",
  glamping: "グランピング",
  campsite: "キャンプ場",
};

const BATH_KIND_LABELS = { public: "大浴場", open_air: "露天", private: "貸切", room_open_air: "客室露天", room: "客室内" };

export const accommodations = pgTable(
  "accommodations",
  {
    destId: uuid("dest_id")
      .primaryKey()
      .references(() => destinations.destId, { onDelete: "cascade" }),
    operatorId: uuid("operator_id").references(() => operators.id, { onDelete: "set null" }),
    kind: text("kind"),
    ...locationColumns(),
    checkIn: time("check_in"),
    checkOut: time("check_out"),
    officialUrl: text("official_url"),
    /** 宿の詳細（部屋・風呂・食事・料金・設備 など）。型つき JSON（docs/data-model.md 2 章）。null は新しい形でまだ入っていない宿 */
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [oneOf("accommodations_kind_check", t.kind, Object.keys(KIND_LABELS)), geoPrecisionCheck("accommodations", t), publishedRead(t.destId)],
);

export const accommodationUnits = pgTable(
  "accommodation_units",
  {
    ...destChildColumns(),
    name: localized("name"),
    capacity: integer("capacity"),
    areaSqm: numeric("area_sqm"),
    tatami: numeric("tatami"),
    style: text("style"),
    view: localized("view"),
  },
  (t) => [
    index("accommodation_units_dest_id_idx").on(t.destId),
    oneOf("accommodation_units_style_check", t.style, ["japanese", "western", "japanese_western"]),
    publishedRead(t.destId),
  ],
);

export const accommodationBedrooms = pgTable(
  "accommodation_bedrooms",
  {
    ...destChildColumns(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => accommodationUnits.id, { onDelete: "cascade" }),
    name: localized("name"),
  },
  (t) => [index("accommodation_bedrooms_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const accommodationBeds = pgTable(
  "accommodation_beds",
  {
    ...destChildColumns(),
    bedroomId: uuid("bedroom_id")
      .notNull()
      .references(() => accommodationBedrooms.id, { onDelete: "cascade" }),
    bedType: text("bed_type"),
    count: integer("count"),
  },
  (t) => [
    index("accommodation_beds_dest_id_idx").on(t.destId),
    oneOf("accommodation_beds_bed_type_check", t.bedType, ["single", "semi_double", "double", "queen", "king", "bunk", "futon", "sofa_bed"]),
    publishedRead(t.destId),
  ],
);

export const accommodationBaths = pgTable(
  "accommodation_baths",
  {
    ...destChildColumns(),
    unitId: uuid("unit_id").references(() => accommodationUnits.id, { onDelete: "cascade" }),
    kind: text("kind"),
    sourceType: text("source_type"),
    spring: text("spring"),
    openFrom: time("open_from"),
    openTo: time("open_to"),
    needsReservation: boolean("needs_reservation"),
    amount: numeric("amount"),
    currency: text("currency"),
    swapsByGender: boolean("swaps_by_gender"),
    note: localized("note"),
  },
  (t) => [
    index("accommodation_baths_dest_id_idx").on(t.destId),
    oneOf("accommodation_baths_kind_check", t.kind, Object.keys(BATH_KIND_LABELS)),
    oneOf("accommodation_baths_source_type_check", t.sourceType, ["natural_flow", "circulated", "heated", "diluted", "none"]),
    currencyCheck("accommodation_baths", t),
    publishedRead(t.destId),
  ],
);

export const accommodationMeals = pgTable(
  "accommodation_meals",
  {
    ...destChildColumns(),
    meal: text("meal"),
    place: text("place"),
    servedFrom: time("served_from"),
    servedTo: time("served_to"),
    allergyOk: boolean("allergy_ok"),
    selfCook: boolean("self_cook"),
    note: localized("note"),
  },
  (t) => [
    index("accommodation_meals_dest_id_idx").on(t.destId),
    oneOf("accommodation_meals_meal_check", t.meal, ["breakfast", "dinner"]),
    oneOf("accommodation_meals_place_check", t.place, ["dining_room", "room", "private_room", "outdoor", "kitchen"]),
    publishedRead(t.destId),
  ],
);

export const accommodationBookingLinks = pgTable(
  "accommodation_booking_links",
  {
    ...destChildColumns(),
    label: text("label"),
    url: text("url").notNull(),
    isOfficial: boolean("is_official").notNull().default(false),
  },
  (t) => [index("accommodation_booking_links_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const accommodationPrices = pgTable(
  "accommodation_prices",
  {
    ...destChildColumns(),
    unitId: uuid("unit_id").references(() => accommodationUnits.id, { onDelete: "cascade" }),
    amount: numeric("amount").notNull(),
    amountMax: numeric("amount_max"),
    currency: text("currency").notNull(),
    guests: integer("guests"),
    meals: text("meals"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    taxIncluded: boolean("tax_included"),
    bathTaxIncluded: boolean("bath_tax_included"),
    lodgingTaxIncluded: boolean("lodging_tax_included"),
    cleaningFeeIncluded: boolean("cleaning_fee_included"),
    bookingLinkId: uuid("booking_link_id").references(() => accommodationBookingLinks.id, { onDelete: "set null" }),
  },
  (t) => [
    index("accommodation_prices_dest_id_idx").on(t.destId),
    oneOf("accommodation_prices_meals_check", t.meals, ["none", "breakfast", "dinner", "both"]),
    currencyCheck("accommodation_prices", t),
    publishedRead(t.destId),
  ],
);

export const accommodationAmenities = pgTable(
  "accommodation_amenities",
  {
    ...destChildColumns(),
    unitId: uuid("unit_id").references(() => accommodationUnits.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    isPaid: boolean("is_paid"),
    note: localized("note"),
  },
  (t) => [index("accommodation_amenities_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const accommodationParkings = pgTable(
  "accommodation_parkings",
  {
    ...destChildColumns(),
    place: text("place"),
    spaces: integer("spaces"),
    maxHeightM: numeric("max_height_m"),
    amount: numeric("amount"),
    currency: text("currency"),
    note: localized("note"),
  },
  (t) => [
    index("accommodation_parkings_dest_id_idx").on(t.destId),
    oneOf("accommodation_parkings_place_check", t.place, ["on_site", "nearby", "none"]),
    currencyCheck("accommodation_parkings", t),
    publishedRead(t.destId),
  ],
);

export const accommodationInternet = pgTable(
  "accommodation_internet",
  {
    ...destChildColumns(),
    hasWifi: boolean("has_wifi"),
    measuredMbps: numeric("measured_mbps"),
    hasDesk: boolean("has_desk"),
    note: localized("note"),
  },
  (t) => [index("accommodation_internet_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const accommodationRules = pgTable(
  "accommodation_rules",
  {
    ...destChildColumns(),
    quietFrom: time("quiet_from"),
    quietTo: time("quiet_to"),
    bbqUntil: time("bbq_until"),
    minNights: integer("min_nights"),
    smoking: text("smoking"),
    partiesAllowed: boolean("parties_allowed"),
    fireworksAllowed: boolean("fireworks_allowed"),
    garbage: localized("garbage"),
    note: localized("note"),
  },
  (t) => [
    index("accommodation_rules_dest_id_idx").on(t.destId),
    oneOf("accommodation_rules_smoking_check", t.smoking, ["none", "designated", "allowed"]),
    publishedRead(t.destId),
  ],
);

export const accommodationAccess = pgTable(
  "accommodation_access",
  {
    ...destChildColumns(),
    nearestStation: text("nearest_station"),
    stationMinutes: integer("station_minutes"),
    hasShuttle: boolean("has_shuttle"),
    hasSlopeOrStairs: boolean("has_slope_or_stairs"),
    needsCar: boolean("needs_car"),
    winterRestriction: localized("winter_restriction"),
    note: localized("note"),
  },
  (t) => [index("accommodation_access_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const accommodationSurroundings = pgTable(
  "accommodation_surroundings",
  {
    ...destChildColumns(),
    neighborDistanceM: integer("neighbor_distance_m"),
    sightlines: localized("sightlines"),
    noiseSources: localized("noise_sources"),
    view: localized("view"),
    elevationM: numeric("elevation_m"),
  },
  (t) => [index("accommodation_surroundings_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const accommodationCautions = pgTable(
  "accommodation_cautions",
  {
    ...destChildColumns(),
    kind: text("kind"),
    note: localized("note"),
  },
  (t) => [index("accommodation_cautions_dest_id_idx").on(t.destId), publishedRead(t.destId)],
);

export const accommodationLicenses = pgTable(
  "accommodation_licenses",
  {
    ...destChildColumns(),
    kind: text("kind"),
    number: text("number"),
  },
  (t) => [
    index("accommodation_licenses_dest_id_idx").on(t.destId),
    oneOf("accommodation_licenses_kind_check", t.kind, ["ryokan_business", "minpaku", "special_zone_minpaku", "simple_lodging"]),
    publishedRead(t.destId),
  ],
);

export const accommodationTexts = pgTable(
  "accommodation_texts",
  { ...textsColumns() },
  (t) => [primaryKey({ columns: [t.destId, t.lang] }), langCheck("accommodation_texts", t), publishedRead(t.destId)],
);

export const accommodationCore: CoreDef = {
  coreType: "accommodation",
  path: "accommodations",
  label: "宿",
  table: accommodations,
  texts: accommodationTexts,
  columns: { kind: "種類", checkIn: "チェックイン", checkOut: "チェックアウト", officialUrl: "公式 URL" },
  kindLabels: KIND_LABELS,
  // 投入は details の JSON 1 つ（accommodations.details）。下の表は、まだ集め直していない宿を詳細の画面で読むためだけに残す
  detailsSchema: accommodationDetailsSchema,
  details: [
    { key: "units", table: accommodationUnits, label: "部屋", columns: { name: "名前", capacity: "定員", areaSqm: "広さ(㎡)", tatami: "畳", style: "和洋", view: "眺望" } },
    { key: "bedrooms", table: accommodationBedrooms, label: "寝室", columns: { name: "名前" }, parent: { key: "units", column: "unitId" } },
    { key: "beds", table: accommodationBeds, label: "寝具", columns: { bedType: "種類", count: "数" }, parent: { key: "bedrooms", column: "bedroomId" } },
    { key: "baths", table: accommodationBaths, label: "風呂", columns: { kind: "種類", sourceType: "源泉の扱い", spring: "泉質", openFrom: "開始", openTo: "終了", needsReservation: "予約", amount: "料金", currency: "通貨", swapsByGender: "男女入替", note: "メモ" } },
    { key: "meals", table: accommodationMeals, label: "食事", columns: { meal: "朝/夕", place: "場所", servedFrom: "開始", servedTo: "終了", allergyOk: "アレルギー対応", selfCook: "自炊", note: "メモ" } },
    { key: "booking_links", table: accommodationBookingLinks, label: "予約先", columns: { label: "名前", url: "URL", isOfficial: "公式" } },
    { key: "prices", table: accommodationPrices, label: "料金", columns: { amount: "金額", amountMax: "金額(上限)", currency: "通貨", guests: "人数", meals: "食事", validFrom: "期間(開始)", validTo: "期間(終了)", taxIncluded: "税込", bathTaxIncluded: "入湯税込", lodgingTaxIncluded: "宿泊税込", cleaningFeeIncluded: "清掃料込" } },
    { key: "amenities", table: accommodationAmenities, label: "設備", columns: { kind: "設備", isPaid: "有料", note: "メモ" } },
    { key: "parkings", table: accommodationParkings, label: "駐車場", columns: { place: "場所", spaces: "台数", maxHeightM: "車高制限(m)", amount: "料金", currency: "通貨", note: "メモ" } },
    { key: "internet", table: accommodationInternet, label: "ネット", columns: { hasWifi: "Wi-Fi", measuredMbps: "実測(Mbps)", hasDesk: "机", note: "メモ" } },
    { key: "rules", table: accommodationRules, label: "ルール", columns: { quietFrom: "静かにする開始", quietTo: "静かにする終了", bbqUntil: "BBQ の終了", minNights: "最短泊数", smoking: "喫煙", partiesAllowed: "パーティー", fireworksAllowed: "花火", garbage: "ゴミ", note: "メモ" } },
    { key: "access", table: accommodationAccess, label: "アクセス", columns: { nearestStation: "最寄り駅", stationMinutes: "駅から(分)", hasShuttle: "送迎", hasSlopeOrStairs: "坂・階段", needsCar: "車が要る", winterRestriction: "冬の規制", note: "メモ" } },
    { key: "surroundings", table: accommodationSurroundings, label: "周辺", columns: { neighborDistanceM: "隣家との距離(m)", sightlines: "視線", noiseSources: "騒音源", view: "眺望", elevationM: "標高(m)" } },
    { key: "cautions", table: accommodationCautions, label: "注意点", columns: { kind: "種類", note: "内容" } },
    { key: "licenses", table: accommodationLicenses, label: "許可・届出", columns: { kind: "種類", number: "番号" } },
  ],
};
