// 宿の語彙（コードと表示名）。zod の z.enum と画面の表示はここを使う
export type Term = { readonly code: string; readonly label: string };

type Codes<T extends readonly Term[]> = { -readonly [K in keyof T]: T[K]["code"] };

// 一覧からコードの tuple を作る（z.enum に渡せる形）
function codesOf<const T extends readonly [Term, ...Term[]]>(list: T): Readonly<Codes<T>> {
  return list.map((t) => t.code) as unknown as Readonly<Codes<T>>;
}

// コードの表示名。知らないコードはそのまま返す
export function labelOf(list: readonly Term[], code: string): string {
  return list.find((t) => t.code === code)?.label ?? code;
}

// ---- 設備（中カテゴリ → 小カテゴリ）----

export const AMENITY_GROUP_LIST = [
  { code: "kitchen", label: "キッチン" },
  { code: "outdoor", label: "屋外" },
  { code: "internet", label: "通信・仕事" },
  { code: "toiletries", label: "洗面" },
  { code: "laundry", label: "洗濯" },
  { code: "room", label: "室内" },
  { code: "entertainment", label: "娯楽" },
  { code: "kids", label: "子ども" },
  { code: "facility", label: "館内" },
  { code: "service", label: "サービス" },
  { code: "accessibility", label: "バリアフリー" },
] as const;
export const AMENITY_GROUPS = codesOf(AMENITY_GROUP_LIST);
export type AmenityGroup = (typeof AMENITY_GROUPS)[number];

export type AmenityItem = Term & { readonly group: AmenityGroup; readonly options: readonly Term[] };

const none: readonly Term[] = [];

export const AMENITY_LIST = [
  { code: "kitchen", label: "キッチン", group: "kitchen", options: none },
  {
    code: "stove",
    label: "コンロ",
    group: "kitchen",
    options: [
      { code: "ih", label: "IH" },
      { code: "gas", label: "ガス" },
    ],
  },
  { code: "microwave", label: "電子レンジ", group: "kitchen", options: none },
  { code: "refrigerator", label: "冷蔵庫", group: "kitchen", options: none },
  { code: "rice_cooker", label: "炊飯器", group: "kitchen", options: none },
  { code: "cookware", label: "調理器具", group: "kitchen", options: none },
  { code: "tableware", label: "食器", group: "kitchen", options: none },
  { code: "dishwasher", label: "食洗機", group: "kitchen", options: none },
  { code: "coffee_maker", label: "コーヒーメーカー", group: "kitchen", options: none },
  {
    code: "bbq",
    label: "BBQ",
    group: "outdoor",
    options: [
      { code: "electric_grill", label: "電気グリル" },
      { code: "charcoal", label: "炭" },
      { code: "gas", label: "ガス" },
      { code: "covered", label: "屋根の下" },
    ],
  },
  { code: "fire_pit", label: "焚き火", group: "outdoor", options: none },
  { code: "terrace", label: "テラス・デッキ", group: "outdoor", options: none },
  { code: "garden", label: "庭", group: "outdoor", options: none },
  {
    code: "pool",
    label: "プール",
    group: "outdoor",
    options: [
      { code: "heated", label: "温水" },
      { code: "private", label: "貸切" },
    ],
  },
  { code: "wifi", label: "Wi-Fi", group: "internet", options: none },
  { code: "wired_lan", label: "有線 LAN", group: "internet", options: none },
  { code: "workspace", label: "仕事用の机", group: "internet", options: none },
  { code: "towel", label: "タオル", group: "toiletries", options: [{ code: "bath_towel", label: "バスタオル" }] },
  { code: "shampoo", label: "シャンプー・ボディソープ", group: "toiletries", options: [{ code: "organic", label: "オーガニック" }] },
  { code: "toothbrush", label: "歯ブラシ", group: "toiletries", options: none },
  { code: "hair_dryer", label: "ドライヤー", group: "toiletries", options: none },
  { code: "pajamas", label: "部屋着", group: "toiletries", options: none },
  { code: "washing_machine", label: "洗濯機", group: "laundry", options: none },
  { code: "dryer", label: "乾燥機", group: "laundry", options: none },
  { code: "coin_laundry", label: "コインランドリー", group: "laundry", options: none },
  { code: "iron", label: "アイロン", group: "laundry", options: none },
  { code: "air_conditioner", label: "エアコン", group: "room", options: none },
  { code: "floor_heating", label: "床暖房", group: "room", options: none },
  { code: "tv", label: "テレビ", group: "room", options: [{ code: "large", label: "大画面" }] },
  { code: "projector", label: "プロジェクター", group: "room", options: none },
  { code: "safe", label: "金庫", group: "room", options: none },
  { code: "karaoke", label: "カラオケ", group: "entertainment", options: none },
  { code: "mahjong", label: "麻雀卓", group: "entertainment", options: [{ code: "automatic", label: "全自動" }] },
  { code: "game_console", label: "ゲーム機", group: "entertainment", options: none },
  { code: "board_games", label: "ボードゲーム", group: "entertainment", options: none },
  { code: "crib", label: "ベビーベッド", group: "kids", options: none },
  { code: "high_chair", label: "子ども用のいす", group: "kids", options: none },
  { code: "kids_amenities", label: "子ども用のアメニティ", group: "kids", options: none },
  { code: "shop", label: "売店", group: "facility", options: none },
  { code: "lounge", label: "ラウンジ", group: "facility", options: none },
  { code: "gym", label: "ジム", group: "facility", options: none },
  { code: "vending_machine", label: "自動販売機", group: "facility", options: none },
  { code: "front_24h", label: "24 時間フロント", group: "service", options: none },
  { code: "luggage_storage", label: "荷物の預かり", group: "service", options: none },
  { code: "self_checkin", label: "非対面のチェックイン", group: "service", options: none },
  { code: "step_free", label: "段差なし", group: "accessibility", options: none },
  { code: "elevator", label: "エレベーター", group: "accessibility", options: none },
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
  { code: "public", label: "大浴場" },
  { code: "open_air", label: "露天風呂" },
  { code: "indoor", label: "内風呂" },
  { code: "private", label: "貸切風呂" },
  { code: "room_open_air", label: "客室露天風呂" },
  { code: "room", label: "客室の風呂" },
  { code: "sauna", label: "サウナ" },
] as const;
export const BATH_KINDS = codesOf(BATH_KIND_LIST);

export const SAUNA_STYLE_LIST = [
  { code: "barrel", label: "バレルサウナ" },
  { code: "dry", label: "ドライサウナ" },
  { code: "steam", label: "スチームサウナ" },
  { code: "tent", label: "テントサウナ" },
] as const;
export const SAUNA_STYLES = codesOf(SAUNA_STYLE_LIST);

export const BATH_GENDER_LIST = [
  { code: "separate", label: "男女別" },
  { code: "mixed", label: "混浴" },
  { code: "private", label: "貸切" },
  { code: "swaps", label: "男女入替" },
] as const;
export const BATH_GENDERS = codesOf(BATH_GENDER_LIST);

export const HOT_SPRING_SOURCE_LIST = [
  { code: "natural_flow", label: "源泉かけ流し" },
  { code: "circulated", label: "循環" },
  { code: "heated", label: "加温" },
  { code: "diluted", label: "加水" },
  { code: "none", label: "温泉ではない" },
] as const;
export const HOT_SPRING_SOURCES = codesOf(HOT_SPRING_SOURCE_LIST);

export const RESERVATION_TIMING_LIST = [
  { code: "at_checkin", label: "チェックインのとき" },
  { code: "in_advance", label: "事前" },
  { code: "on_site", label: "当日その場" },
] as const;
export const RESERVATION_TIMINGS = codesOf(RESERVATION_TIMING_LIST);

// ---- 食事 ----

export const MEAL_LIST = [
  { code: "breakfast", label: "朝食" },
  { code: "dinner", label: "夕食" },
] as const;
export const MEALS = codesOf(MEAL_LIST);

export const MEAL_STYLE_LIST = [
  { code: "buffet", label: "ビュッフェ" },
  { code: "kaiseki", label: "会席" },
  { code: "set", label: "定食" },
  { code: "bbq_set", label: "BBQ セット" },
  { code: "course", label: "コース" },
] as const;
export const MEAL_STYLES = codesOf(MEAL_STYLE_LIST);

export const MEAL_PLACE_LIST = [
  { code: "dining_room", label: "食事処" },
  { code: "room", label: "部屋" },
  { code: "private_room", label: "個室" },
  { code: "outdoor", label: "屋外" },
  { code: "kitchen", label: "キッチン" },
] as const;
export const MEAL_PLACES = codesOf(MEAL_PLACE_LIST);

// ---- 料金 ----

export const PRICE_KIND_LIST = [
  { code: "room", label: "宿泊料" },
  { code: "meal", label: "食事" },
  { code: "service_fee", label: "諸経費" },
  { code: "bath_tax", label: "入湯税" },
  { code: "lodging_tax", label: "宿泊税" },
  { code: "cleaning", label: "清掃料" },
] as const;
export const PRICE_KINDS = codesOf(PRICE_KIND_LIST);

export const PRICE_PER_LIST = [
  { code: "house_night", label: "1 棟 1 泊" },
  { code: "room_night", label: "1 室 1 泊" },
  { code: "person_night", label: "1 名 1 泊" },
  { code: "stay", label: "1 回の滞在" },
] as const;
export const PRICE_PERS = codesOf(PRICE_PER_LIST);

export const PRICE_AUDIENCE_LIST = [
  { code: "all", label: "全員" },
  { code: "adult", label: "大人" },
  { code: "child", label: "子ども" },
] as const;
export const PRICE_AUDIENCES = codesOf(PRICE_AUDIENCE_LIST);

export const PRICE_MEALS_LIST = [
  { code: "none", label: "素泊まり" },
  { code: "breakfast", label: "朝食つき" },
  { code: "dinner", label: "夕食つき" },
  { code: "both", label: "2 食つき" },
] as const;
export const PRICE_MEALS = codesOf(PRICE_MEALS_LIST);

// ---- そのほか ----

export const ROOM_STYLE_LIST = [
  { code: "japanese", label: "和室" },
  { code: "western", label: "洋室" },
  { code: "japanese_western", label: "和洋室" },
] as const;
export const ROOM_STYLES = codesOf(ROOM_STYLE_LIST);

export const SMOKING_LIST = [
  { code: "none", label: "禁煙" },
  { code: "designated", label: "指定の場所" },
  { code: "allowed", label: "喫煙可" },
] as const;
export const SMOKINGS = codesOf(SMOKING_LIST);

export const BED_TYPE_LIST = [
  { code: "single", label: "シングル" },
  { code: "semi_double", label: "セミダブル" },
  { code: "double", label: "ダブル" },
  { code: "queen", label: "クイーン" },
  { code: "king", label: "キング" },
  { code: "bunk", label: "二段ベッド" },
  { code: "futon", label: "布団" },
  { code: "sofa_bed", label: "ソファベッド" },
] as const;
export const BED_TYPES = codesOf(BED_TYPE_LIST);

export const DESK_SCOPE_LIST = [
  { code: "all_rooms", label: "全室" },
  { code: "some_rooms", label: "一部の部屋" },
  { code: "common", label: "共用部" },
] as const;
export const DESK_SCOPES = codesOf(DESK_SCOPE_LIST);

export const ACCESS_MODE_LIST = [
  { code: "walk", label: "徒歩" },
  { code: "bus", label: "バス" },
  { code: "car", label: "車" },
  { code: "shuttle", label: "送迎" },
] as const;
export const ACCESS_MODES = codesOf(ACCESS_MODE_LIST);

export const PET_SIZE_LIST = [
  { code: "small", label: "小型" },
  { code: "medium", label: "中型" },
  { code: "large", label: "大型" },
] as const;
export const PET_SIZES = codesOf(PET_SIZE_LIST);

export const PARKING_PLACE_LIST = [
  { code: "on_site", label: "敷地内" },
  { code: "nearby", label: "近く" },
  { code: "none", label: "なし" },
] as const;
export const PARKING_PLACES = codesOf(PARKING_PLACE_LIST);

export const SOURCE_TYPE_LIST = [
  { code: "official", label: "公式" },
  { code: "ota", label: "予約サイト" },
  { code: "map", label: "地図" },
  { code: "other", label: "そのほか" },
] as const;
export const SOURCE_TYPES = codesOf(SOURCE_TYPE_LIST);
