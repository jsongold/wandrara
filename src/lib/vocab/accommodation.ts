// 宿の語彙（コードと表示名）。zod の z.enum と画面の表示はここを使う
import type { Locale } from "../types.ts";

// label は日本語、en は英語の表示名
export type Term = { readonly code: string; readonly label: string; readonly en: string };

type Codes<T extends readonly Term[]> = { -readonly [K in keyof T]: T[K]["code"] };

// 一覧からコードの tuple を作る（z.enum に渡せる形）
export function codesOf<const T extends readonly [Term, ...Term[]]>(list: T): Readonly<Codes<T>> {
  return list.map((t) => t.code) as unknown as Readonly<Codes<T>>;
}

// コードの表示名。知らないコードはそのまま返す
export function labelOf(list: readonly Term[], code: string, locale: Locale = "ja"): string {
  const t = list.find((x) => x.code === code);
  if (!t) return code;
  return locale === "en" ? t.en : t.label;
}

// ---- 設備（中カテゴリ → 小カテゴリ）----

export const AMENITY_GROUP_LIST = [
  { code: "kitchen", label: "キッチン", en: "Kitchen" },
  { code: "outdoor", label: "屋外", en: "Outdoor" },
  { code: "internet", label: "通信・仕事", en: "Internet and work" },
  { code: "toiletries", label: "洗面", en: "Toiletries" },
  { code: "laundry", label: "洗濯", en: "Laundry" },
  { code: "room", label: "室内", en: "In the room" },
  { code: "entertainment", label: "娯楽", en: "Entertainment" },
  { code: "kids", label: "子ども", en: "Children" },
  { code: "facility", label: "館内", en: "Facilities" },
  { code: "service", label: "サービス", en: "Services" },
  { code: "accessibility", label: "バリアフリー", en: "Accessibility" },
] as const;
export const AMENITY_GROUPS = codesOf(AMENITY_GROUP_LIST);
export type AmenityGroup = (typeof AMENITY_GROUPS)[number];

export type AmenityItem = Term & { readonly group: AmenityGroup; readonly options: readonly Term[] };

const none: readonly Term[] = [];

export const AMENITY_LIST = [
  { code: "kitchen", label: "キッチン", en: "Kitchen", group: "kitchen", options: none },
  {
    code: "stove",
    label: "コンロ", en: "Stove",
    group: "kitchen",
    options: [
      { code: "ih", label: "IH", en: "Induction" },
      { code: "gas", label: "ガス", en: "Gas" },
    ],
  },
  { code: "microwave", label: "電子レンジ", en: "Microwave", group: "kitchen", options: none },
  { code: "refrigerator", label: "冷蔵庫", en: "Refrigerator", group: "kitchen", options: none },
  { code: "rice_cooker", label: "炊飯器", en: "Rice cooker", group: "kitchen", options: none },
  { code: "cookware", label: "調理器具", en: "Cookware", group: "kitchen", options: none },
  { code: "tableware", label: "食器", en: "Tableware", group: "kitchen", options: none },
  { code: "dishwasher", label: "食洗機", en: "Dishwasher", group: "kitchen", options: none },
  { code: "coffee_maker", label: "コーヒーメーカー", en: "Coffee maker", group: "kitchen", options: none },
  {
    code: "bbq",
    label: "BBQ", en: "BBQ",
    group: "outdoor",
    options: [
      { code: "electric_grill", label: "電気グリル", en: "Electric grill" },
      { code: "charcoal", label: "炭", en: "Charcoal" },
      { code: "gas", label: "ガス", en: "Gas" },
      { code: "covered", label: "屋根の下", en: "Covered" },
    ],
  },
  { code: "fire_pit", label: "焚き火", en: "Fire pit", group: "outdoor", options: none },
  { code: "terrace", label: "テラス・デッキ", en: "Terrace or deck", group: "outdoor", options: none },
  { code: "garden", label: "庭", en: "Garden", group: "outdoor", options: none },
  {
    code: "pool",
    label: "プール", en: "Pool",
    group: "outdoor",
    options: [
      { code: "heated", label: "温水", en: "Heated" },
      { code: "private", label: "貸切", en: "Private" },
    ],
  },
  { code: "wifi", label: "Wi-Fi", en: "Wi-Fi", group: "internet", options: none },
  { code: "wired_lan", label: "有線 LAN", en: "Wired LAN", group: "internet", options: none },
  { code: "workspace", label: "仕事用の机", en: "Work desk", group: "internet", options: none },
  { code: "towel", label: "タオル", en: "Towels", group: "toiletries", options: [{ code: "bath_towel", label: "バスタオル", en: "Bath towels" }] },
  { code: "shampoo", label: "シャンプー・ボディソープ", en: "Shampoo and body soap", group: "toiletries", options: [{ code: "organic", label: "オーガニック", en: "Organic" }] },
  { code: "toothbrush", label: "歯ブラシ", en: "Toothbrushes", group: "toiletries", options: none },
  { code: "hair_dryer", label: "ドライヤー", en: "Hair dryer", group: "toiletries", options: none },
  { code: "pajamas", label: "部屋着", en: "Loungewear", group: "toiletries", options: none },
  { code: "washing_machine", label: "洗濯機", en: "Washing machine", group: "laundry", options: none },
  { code: "dryer", label: "乾燥機", en: "Dryer", group: "laundry", options: none },
  { code: "coin_laundry", label: "コインランドリー", en: "Coin laundry", group: "laundry", options: none },
  { code: "iron", label: "アイロン", en: "Iron", group: "laundry", options: none },
  { code: "air_conditioner", label: "エアコン", en: "Air conditioning", group: "room", options: none },
  { code: "floor_heating", label: "床暖房", en: "Floor heating", group: "room", options: none },
  { code: "tv", label: "テレビ", en: "TV", group: "room", options: [{ code: "large", label: "大画面", en: "Large screen" }] },
  { code: "projector", label: "プロジェクター", en: "Projector", group: "room", options: none },
  { code: "safe", label: "金庫", en: "Safe", group: "room", options: none },
  { code: "karaoke", label: "カラオケ", en: "Karaoke", group: "entertainment", options: none },
  { code: "mahjong", label: "麻雀卓", en: "Mahjong table", group: "entertainment", options: [{ code: "automatic", label: "全自動", en: "Automatic" }] },
  { code: "game_console", label: "ゲーム機", en: "Game console", group: "entertainment", options: none },
  { code: "board_games", label: "ボードゲーム", en: "Board games", group: "entertainment", options: none },
  { code: "crib", label: "ベビーベッド", en: "Crib", group: "kids", options: none },
  { code: "high_chair", label: "子ども用のいす", en: "High chair", group: "kids", options: none },
  { code: "kids_amenities", label: "子ども用のアメニティ", en: "Kids amenities", group: "kids", options: none },
  { code: "shop", label: "売店", en: "Shop", group: "facility", options: none },
  { code: "lounge", label: "ラウンジ", en: "Lounge", group: "facility", options: none },
  { code: "gym", label: "ジム", en: "Gym", group: "facility", options: none },
  { code: "vending_machine", label: "自動販売機", en: "Vending machine", group: "facility", options: none },
  { code: "front_24h", label: "24 時間フロント", en: "24-hour front desk", group: "service", options: none },
  { code: "luggage_storage", label: "荷物の預かり", en: "Luggage storage", group: "service", options: none },
  { code: "self_checkin", label: "非対面のチェックイン", en: "Self check-in", group: "service", options: none },
  { code: "step_free", label: "段差なし", en: "Step-free", group: "accessibility", options: none },
  { code: "elevator", label: "エレベーター", en: "Elevator", group: "accessibility", options: none },
] as const satisfies readonly AmenityItem[];
export const AMENITIES = codesOf(AMENITY_LIST);
export type Amenity = (typeof AMENITIES)[number];

function findAmenity(code: string): AmenityItem | undefined {
  return (AMENITY_LIST as readonly AmenityItem[]).find((a) => a.code === code);
}

// 設備の中カテゴリ。知らないコードは undefined
export function amenityGroupOf(code: string): Term | undefined {
  const group = findAmenity(code)?.group;
  return AMENITY_GROUP_LIST.find((g) => g.code === group);
}

// 設備に付けられるもの（options）。無いときと知らないコードは空
export function amenityOptions(code: string): readonly Term[] {
  return findAmenity(code)?.options ?? none;
}

// ---- 風呂 ----

export const BATH_KIND_LIST = [
  { code: "public", label: "大浴場", en: "Large public bath" },
  { code: "open_air", label: "露天風呂", en: "Open-air bath" },
  { code: "indoor", label: "内風呂", en: "Indoor bath" },
  { code: "private", label: "貸切風呂", en: "Private bath" },
  { code: "room_open_air", label: "客室露天風呂", en: "In-room open-air bath" },
  { code: "room", label: "客室の風呂", en: "In-room bath" },
  { code: "sauna", label: "サウナ", en: "Sauna" },
] as const;
export const BATH_KINDS = codesOf(BATH_KIND_LIST);

export const SAUNA_STYLE_LIST = [
  { code: "barrel", label: "バレルサウナ", en: "Barrel sauna" },
  { code: "dry", label: "ドライサウナ", en: "Dry sauna" },
  { code: "steam", label: "スチームサウナ", en: "Steam sauna" },
  { code: "tent", label: "テントサウナ", en: "Tent sauna" },
] as const;
export const SAUNA_STYLES = codesOf(SAUNA_STYLE_LIST);

export const BATH_GENDER_LIST = [
  { code: "separate", label: "男女別", en: "Separate for men and women" },
  { code: "mixed", label: "混浴", en: "Mixed" },
  { code: "private", label: "貸切", en: "Private" },
  { code: "swaps", label: "男女入替", en: "Alternates between men and women" },
] as const;
export const BATH_GENDERS = codesOf(BATH_GENDER_LIST);

export const HOT_SPRING_SOURCE_LIST = [
  { code: "natural_flow", label: "源泉かけ流し", en: "Free-flowing spring water" },
  { code: "circulated", label: "循環", en: "Recirculated" },
  { code: "heated", label: "加温", en: "Heated" },
  { code: "diluted", label: "加水", en: "Diluted with water" },
  { code: "none", label: "温泉ではない", en: "Not a hot spring" },
] as const;
export const HOT_SPRING_SOURCES = codesOf(HOT_SPRING_SOURCE_LIST);

export const RESERVATION_TIMING_LIST = [
  { code: "at_checkin", label: "チェックインのとき", en: "At check-in" },
  { code: "in_advance", label: "事前", en: "In advance" },
  { code: "on_site", label: "当日その場", en: "On the day, on site" },
] as const;
export const RESERVATION_TIMINGS = codesOf(RESERVATION_TIMING_LIST);

// ---- 食事 ----

export const MEAL_LIST = [
  { code: "breakfast", label: "朝食", en: "Breakfast" },
  { code: "dinner", label: "夕食", en: "Dinner" },
] as const;
export const MEALS = codesOf(MEAL_LIST);

export const MEAL_STYLE_LIST = [
  { code: "buffet", label: "ビュッフェ", en: "Buffet" },
  { code: "kaiseki", label: "会席", en: "Kaiseki" },
  { code: "set", label: "定食", en: "Set meal" },
  { code: "bbq_set", label: "BBQ セット", en: "BBQ set" },
  { code: "course", label: "コース", en: "Course" },
] as const;
export const MEAL_STYLES = codesOf(MEAL_STYLE_LIST);

export const MEAL_PLACE_LIST = [
  { code: "dining_room", label: "食事処", en: "Dining room" },
  { code: "room", label: "部屋", en: "In the room" },
  { code: "private_room", label: "個室", en: "Private room" },
  { code: "outdoor", label: "屋外", en: "Outdoor" },
  { code: "kitchen", label: "キッチン", en: "Kitchen" },
] as const;
export const MEAL_PLACES = codesOf(MEAL_PLACE_LIST);

// ---- 料金 ----

export const PRICE_KIND_LIST = [
  { code: "room", label: "宿泊料", en: "Room rate" },
  { code: "meal", label: "食事", en: "Meals" },
  { code: "service_fee", label: "諸経費", en: "Service fee" },
  { code: "bath_tax", label: "入湯税", en: "Bath tax" },
  { code: "lodging_tax", label: "宿泊税", en: "Lodging tax" },
  { code: "cleaning", label: "清掃料", en: "Cleaning fee" },
] as const;
export const PRICE_KINDS = codesOf(PRICE_KIND_LIST);

export const PRICE_PER_LIST = [
  { code: "house_night", label: "1 棟 1 泊", en: "per house per night" },
  { code: "room_night", label: "1 室 1 泊", en: "per room per night" },
  { code: "person_night", label: "1 名 1 泊", en: "per person per night" },
  { code: "stay", label: "1 回の滞在", en: "per stay" },
] as const;
export const PRICE_PERS = codesOf(PRICE_PER_LIST);

export const PRICE_AUDIENCE_LIST = [
  { code: "all", label: "全員", en: "Everyone" },
  { code: "adult", label: "大人", en: "Adults" },
  { code: "child", label: "子ども", en: "Children" },
] as const;
export const PRICE_AUDIENCES = codesOf(PRICE_AUDIENCE_LIST);

export const PRICE_MEALS_LIST = [
  { code: "none", label: "素泊まり", en: "Room only" },
  { code: "breakfast", label: "朝食つき", en: "Breakfast included" },
  { code: "dinner", label: "夕食つき", en: "Dinner included" },
  { code: "both", label: "2 食つき", en: "Breakfast and dinner" },
] as const;
export const PRICE_MEALS = codesOf(PRICE_MEALS_LIST);

// ---- そのほか ----

export const ROOM_STYLE_LIST = [
  { code: "japanese", label: "和室", en: "Japanese-style" },
  { code: "western", label: "洋室", en: "Western-style" },
  { code: "japanese_western", label: "和洋室", en: "Japanese-Western style" },
] as const;
export const ROOM_STYLES = codesOf(ROOM_STYLE_LIST);

export const SMOKING_LIST = [
  { code: "none", label: "禁煙", en: "Non-smoking" },
  { code: "designated", label: "指定の場所", en: "Designated areas only" },
  { code: "allowed", label: "喫煙可", en: "Smoking allowed" },
] as const;
export const SMOKINGS = codesOf(SMOKING_LIST);

export const BED_TYPE_LIST = [
  { code: "single", label: "シングル", en: "Single" },
  { code: "semi_double", label: "セミダブル", en: "Semi-double" },
  { code: "double", label: "ダブル", en: "Double" },
  { code: "queen", label: "クイーン", en: "Queen" },
  { code: "king", label: "キング", en: "King" },
  { code: "bunk", label: "二段ベッド", en: "Bunk bed" },
  { code: "futon", label: "布団", en: "Futon" },
  { code: "sofa_bed", label: "ソファベッド", en: "Sofa bed" },
] as const;
export const BED_TYPES = codesOf(BED_TYPE_LIST);

export const DESK_SCOPE_LIST = [
  { code: "all_rooms", label: "全室", en: "All rooms" },
  { code: "some_rooms", label: "一部の部屋", en: "Some rooms" },
  { code: "common", label: "共用部", en: "Shared areas" },
] as const;
export const DESK_SCOPES = codesOf(DESK_SCOPE_LIST);

export const ACCESS_MODE_LIST = [
  { code: "walk", label: "徒歩", en: "Walk" },
  { code: "bus", label: "バス", en: "Bus" },
  { code: "car", label: "車", en: "Car" },
  { code: "shuttle", label: "送迎", en: "Shuttle" },
] as const;
export const ACCESS_MODES = codesOf(ACCESS_MODE_LIST);

export const PET_SIZE_LIST = [
  { code: "small", label: "小型", en: "Small" },
  { code: "medium", label: "中型", en: "Medium" },
  { code: "large", label: "大型", en: "Large" },
] as const;
export const PET_SIZES = codesOf(PET_SIZE_LIST);

export const PARKING_PLACE_LIST = [
  { code: "on_site", label: "敷地内", en: "On site" },
  { code: "nearby", label: "近く", en: "Nearby" },
  { code: "none", label: "なし", en: "None" },
] as const;
export const PARKING_PLACES = codesOf(PARKING_PLACE_LIST);

export const SOURCE_TYPE_LIST = [
  { code: "official", label: "公式", en: "Official" },
  { code: "ota", label: "予約サイト", en: "Booking site" },
  { code: "map", label: "地図", en: "Map" },
  { code: "other", label: "そのほか", en: "Other" },
] as const;
export const SOURCE_TYPES = codesOf(SOURCE_TYPE_LIST);
