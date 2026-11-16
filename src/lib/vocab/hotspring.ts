// 日帰り温泉の語彙（コードと表示名）。出典の種類・対象・源泉の扱いは宿と同じ、行き方は自然と同じ
import { codesOf } from "./accommodation.ts";

export { HOT_SPRING_SOURCE_LIST, HOT_SPRING_SOURCES, labelOf, PRICE_AUDIENCE_LIST as AUDIENCE_LIST, PRICE_AUDIENCES as AUDIENCES, type Term } from "./accommodation.ts";
export { ACCESS_MODE_LIST, ACCESS_MODES } from "./nature.ts";

// db/schema/hotspring.ts の KIND_LABELS と同じ
export const KIND_LIST = [
  { code: "day_use", label: "日帰り温泉", en: "Day-use hot spring" },
  { code: "public_bath", label: "外湯", en: "Public bath" },
  { code: "foot_bath", label: "足湯", en: "Foot bath" },
] as const;
export const KINDS = codesOf(KIND_LIST);

// 風呂の種類。宿の BATH_KIND_LIST と同じコード・表示名に、足湯（foot）を足したもの
export const BATH_KIND_LIST = [
  { code: "public", label: "大浴場", en: "Large public bath" },
  { code: "open_air", label: "露天風呂", en: "Open-air bath" },
  { code: "indoor", label: "内風呂", en: "Indoor bath" },
  { code: "private", label: "貸切風呂", en: "Private bath" },
  { code: "sauna", label: "サウナ", en: "Sauna" },
  { code: "foot", label: "足湯", en: "Foot bath" }, // 日帰り温泉だけ（宿には無い）
] as const;
export const BATH_KINDS = codesOf(BATH_KIND_LIST);

// 男女（宿の BATH_GENDER_LIST のうち入替を除く）
export const BATH_GENDER_LIST = [
  { code: "separate", label: "男女別", en: "Separate for men and women" },
  { code: "mixed", label: "混浴", en: "Mixed" },
  { code: "private", label: "貸切", en: "Private" },
] as const;
export const BATH_GENDERS = codesOf(BATH_GENDER_LIST);

// タオル
export const TOWEL_LIST = [
  { code: "free", label: "無料", en: "Free" },
  { code: "rental", label: "貸し出し", en: "Rental" },
  { code: "sale", label: "販売", en: "For sale" },
  { code: "none", label: "なし", en: "None" },
] as const;
export const TOWELS = codesOf(TOWEL_LIST);
