// 建物の語彙（コードと表示名）。出典の種類・対象（大人・子ども）は宿と同じ、行き方は自然と同じ
import { codesOf } from "./accommodation.ts";

export { labelOf, PRICE_AUDIENCE_LIST as AUDIENCE_LIST, PRICE_AUDIENCES as AUDIENCES, type Term } from "./accommodation.ts";
export { ACCESS_MODE_LIST, ACCESS_MODES } from "./nature.ts";

// db/schema/building.ts の BUILDING_KIND_LABELS と同じ
export const KIND_LIST = [
  { code: "museum", label: "美術館・博物館", en: "Museum" },
  { code: "shrine", label: "神社", en: "Shrine" },
  { code: "temple", label: "寺", en: "Temple" },
  { code: "castle", label: "城", en: "Castle" },
  { code: "observatory", label: "展望台", en: "Observation deck" },
  { code: "historic_building", label: "歴史的建造物", en: "Historic building" },
] as const;
export const KINDS = codesOf(KIND_LIST);
