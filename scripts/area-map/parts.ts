// 元データの地物を読み、エリアの材料コードに当てる
import mapshaper from "mapshaper";
import type { RegionPart } from "../../src/lib/region/types.ts";
import { cityOfKeyCode } from "./sources.ts";

export type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: unknown };
export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };
/** n03：市区町村（N03_007）の地物、estat：市区町村コード → 小地域の地物 */
export type Sources = { n03: FeatureCollection; estat: Record<string, FeatureCollection> };

export const q = (s: string) => `'${s}'`;

/** mapshaper のコマンドを流し、GeoJSON の FeatureCollection で受け取る */
export async function run(cmd: string, input?: Record<string, string>): Promise<FeatureCollection> {
  const out = await mapshaper.applyCommands(`${cmd} -o format=geojson out.json`, input);
  const g = JSON.parse(String(out["out.json"]));
  if (g.type === "GeometryCollection") {
    return { type: "FeatureCollection", features: g.geometries.map((geometry: unknown) => ({ type: "Feature", properties: {}, geometry })) };
  }
  return g;
}

export const fc = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });

/** 材料 1 行に当たる地物。1 つも無ければ失敗（版の違い・合併で消えたコードを静かに通さない） */
export function featuresOfPart(part: RegionPart, src: Sources): Feature[] {
  const found =
    part.source === "n03"
      ? src.n03.features.filter((f) => f.properties.N03_007 === part.code)
      : (src.estat[cityOfKeyCode(part.code)]?.features ?? []).filter((f) => f.properties.KEY_CODE === part.code);
  if (found.length === 0) throw new Error(`元データに材料がありません: ${part.source} ${part.version} ${part.code}`);
  return found;
}

/** 材料の列の地物を集め、properties.area にエリア id を入れる */
export function featuresOf(id: string, parts: RegionPart[], src: Sources): Feature[] {
  return parts.flatMap((p) => featuresOfPart(p, src).map((f) => ({ type: "Feature" as const, properties: { area: id }, geometry: f.geometry })));
}

/** 材料が使う市区町村コード（n03 はそのまま、estat は KEY_CODE の先頭 5 桁） */
export function citiesOf(parts: RegionPart[]): { all: string[]; estat: string[] } {
  const all = new Set<string>();
  const estat = new Set<string>();
  for (const p of parts) {
    const city = p.source === "n03" ? p.code : cityOfKeyCode(p.code);
    all.add(city);
    if (p.source === "estat") estat.add(city);
  }
  return { all: [...all].sort(), estat: [...estat].sort() };
}
