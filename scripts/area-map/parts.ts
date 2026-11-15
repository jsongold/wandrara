// エリア定義に従って、元データの地物をエリアに割り当てる（純関数）
import type { Part } from "./areas.ts";

export type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: unknown };
export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };
export type Sources = { n03: FeatureCollection; estat: Record<string, FeatureCollection> };

function matches(part: Part, f: Feature, source: "n03" | string): boolean {
  if ("n03" in part) return source === "n03" && f.properties.N03_007 === part.n03;
  if (source !== part.estat) return false;
  if ("names" in part) return part.names.includes(String(f.properties.S_NAME));
  const head = Number(String(f.properties.S_AREA).slice(0, 3));
  return head >= part.codeRange[0] && head <= part.codeRange[1];
}

// 指定したエリアの地物を集め、properties.area にエリア id を入れて返す
export function featuresFor(ids: string[], parts: Record<string, Part[]>, src: Sources): Feature[] {
  const out: Feature[] = [];
  for (const id of ids) {
    const ps = parts[id];
    if (!ps) throw new Error(`エリア定義がありません: ${id}`);
    let found = 0;
    for (const part of ps) {
      const [source, fc] = "n03" in part ? ["n03", src.n03] : [part.estat, src.estat[part.estat]];
      if (!fc) throw new Error(`元データがありません: e-Stat ${source}`);
      for (const f of fc.features) {
        if (matches(part, f, source)) {
          out.push({ type: "Feature", properties: { area: id }, geometry: f.geometry });
          found++;
        }
      }
    }
    if (found === 0) throw new Error(`エリアの形が 1 つも見つかりません: ${id}`);
  }
  return out;
}

// エリア定義が使う市区町村コード（N03）と e-Stat の市区町村コード
export function sourceCodes(ids: string[], parts: Record<string, Part[]>): { n03: string[]; estat: string[] } {
  const n03 = new Set<string>();
  const estat = new Set<string>();
  for (const id of ids) {
    for (const p of parts[id] ?? []) {
      if ("n03" in p) n03.add(p.n03);
      else estat.add(p.estat);
    }
  }
  return { n03: [...n03], estat: [...estat] };
}
