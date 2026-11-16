// まちの語彙（コードと表示名）。出典の種類は宿と同じ、行き方は自然と同じ
import { codesOf } from "./accommodation.ts";

export { labelOf, type Term } from "./accommodation.ts";
export { ACCESS_MODE_LIST, ACCESS_MODES } from "./nature.ts";

// db/schema/village.ts の KIND_LABELS と同じ
export const KIND_LIST = [
  { code: "onsen_town", label: "温泉街", en: "Hot spring town" },
  { code: "post_town", label: "宿場町", en: "Post town" },
  { code: "fishing_village", label: "漁村", en: "Fishing village" },
  { code: "temple_town", label: "門前町", en: "Temple town" },
  { code: "castle_town", label: "城下町", en: "Castle town" },
] as const;
export const KINDS = codesOf(KIND_LIST);
