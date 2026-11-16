// dest の代表の位置を 1 つ選ぶ。カード用ビュー（dest_cards）と同じ選び方にする
// - 体験以外：コアの lat・lng・geo_precision・prefecture・municipality
// - 体験：details.locations の kind = meeting の先頭、無ければ先頭。その場所に座標が無ければ位置なし（2 件目以降は探さない）
import { GEO_PRECISIONS } from "../../db/schema/_shared.ts";
import type { GeoPrecision, RepresentativeLocation } from "./types.ts";

type Row = Record<string, unknown>;

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const precisionOf = (v: unknown): GeoPrecision | null =>
  (GEO_PRECISIONS as readonly string[]).includes(v as string) ? (v as GeoPrecision) : null;

export function representativeLocation(coreType: string, core: Row, details: unknown): RepresentativeLocation {
  if (coreType === "experience") {
    const locs = (details && typeof details === "object" ? (details as Row).locations : null) as Row[] | null;
    const list = Array.isArray(locs) ? locs : [];
    const loc = list.find((l) => l?.kind === "meeting") ?? list[0];
    return {
      lat: numOrNull(loc?.lat),
      lng: numOrNull(loc?.lng),
      precision: precisionOf(loc?.geo_precision),
      prefecture: null,
      municipality: null,
    };
  }
  return {
    lat: numOrNull(core.lat),
    lng: numOrNull(core.lng),
    precision: precisionOf(core.geo_precision),
    prefecture: strOrNull(core.prefecture),
    municipality: strOrNull(core.municipality),
  };
}
