// 体験の語彙（コードと表示名）。zod の z.enum と画面の表示はここを使う。出典の種類・対象（大人・子ども）は宿と同じ
import { codesOf } from "./accommodation.ts";

export { labelOf, PRICE_AUDIENCE_LIST as AUDIENCE_LIST, PRICE_AUDIENCES as AUDIENCES, type Term } from "./accommodation.ts";

// 体験の kind は DB の experiences.kind（db/schema/experience.ts の KIND_LABELS）。ここには持たない

// 料金の単位（1 名・1 グループ・1 回）
export const PRICE_PER_LIST = [
  { code: "person", label: "1 名", en: "per person" },
  { code: "group", label: "1 グループ", en: "per group" },
  { code: "session", label: "1 回", en: "per session" },
] as const;
export const PRICE_PERS = codesOf(PRICE_PER_LIST);

export const LOCATION_KIND_LIST = [
  { code: "meeting", label: "集合場所", en: "Meeting point" },
  { code: "activity", label: "実施場所", en: "Activity location" },
] as const;
export const LOCATION_KINDS = codesOf(LOCATION_KIND_LIST);

export const INCLUSION_KIND_LIST = [
  { code: "included", label: "含むもの", en: "Included" },
  { code: "excluded", label: "含まないもの", en: "Not included" },
  { code: "bring", label: "持ち物", en: "What to bring" },
] as const;
export const INCLUSION_KINDS = codesOf(INCLUSION_KIND_LIST);
