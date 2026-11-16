// 自然の語彙（コードと表示名）。zod の z.enum と画面の表示はここを使う。出典の種類・対象（大人・子ども）は宿と同じ
import { codesOf } from "./accommodation.ts";

export { labelOf, PRICE_AUDIENCE_LIST as AUDIENCE_LIST, PRICE_AUDIENCES as AUDIENCES, type Term } from "./accommodation.ts";

// db/schema/nature.ts の KIND_LABELS と同じ
export const KIND_LIST = [
  { code: "coast", label: "海岸", en: "Coast" },
  { code: "mountain", label: "山", en: "Mountain" },
  { code: "lake", label: "湖", en: "Lake" },
  { code: "highland", label: "高原", en: "Highland" },
  { code: "gorge", label: "渓谷", en: "Gorge" },
  { code: "waterfall", label: "滝", en: "Waterfall" },
  { code: "forest", label: "森", en: "Forest" },
  { code: "volcano", label: "火山", en: "Volcano" },
] as const;
export const KINDS = codesOf(KIND_LIST);

// natures.protection と同じ
export const PROTECTION_LIST = [
  { code: "national_park", label: "国立公園", en: "National park" },
  { code: "quasi_national_park", label: "国定公園", en: "Quasi-national park" },
  { code: "prefectural_park", label: "県立自然公園", en: "Prefectural natural park" },
  { code: "geopark", label: "ジオパーク", en: "Geopark" },
  { code: "none", label: "指定なし", en: "Not designated" },
] as const;
export const PROTECTIONS = codesOf(PROTECTION_LIST);

export const DIFFICULTY_LIST = [
  { code: "easy", label: "易しい", en: "Easy" },
  { code: "moderate", label: "普通", en: "Moderate" },
  { code: "hard", label: "難しい", en: "Hard" },
] as const;
export const DIFFICULTIES = codesOf(DIFFICULTY_LIST);

export const RESTRICTION_KIND_LIST = [
  { code: "closure", label: "立入禁止", en: "Closed to entry" },
  { code: "volcanic_gas", label: "火山ガス警戒", en: "Volcanic gas warning" },
  { code: "other", label: "その他", en: "Other" },
] as const;
export const RESTRICTION_KINDS = codesOf(RESTRICTION_KIND_LIST);

// 行き方（宿の ACCESS_MODE から送迎を除いたもの）
export const ACCESS_MODE_LIST = [
  { code: "walk", label: "徒歩", en: "Walk" },
  { code: "bus", label: "バス", en: "Bus" },
  { code: "car", label: "車", en: "Car" },
] as const;
export const ACCESS_MODES = codesOf(ACCESS_MODE_LIST);
