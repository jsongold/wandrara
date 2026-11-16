// 一度だけ使う：以前の手書きのエリア定義（seed-fixture.ts）を 1 コード 1 行に展開し、region_parts の初期行の SQL にする
// 使い方: node scripts/area-map/seed-parts.ts <出力する migration の .sql>
import fs from "node:fs";
import type { RegionPart } from "../../src/lib/region/types.ts";
import { fc, run, type FeatureCollection, q } from "./parts.ts";
import { AREA_PARTS, AREA_POINTS, type Part } from "./seed-fixture.ts";
import { fetchSources, SOURCE_VERSIONS } from "./sources.ts";

/** 以前の定義を材料コードに展開する（純関数）。estat は市区町村ごとの小地域の地物 */
export function expandParts(defs: Record<string, Part[]>, estat: Record<string, FeatureCollection>): Map<string, RegionPart[]> {
  const out = new Map<string, RegionPart[]>();
  for (const [id, parts] of Object.entries(defs)) {
    const rows: RegionPart[] = [];
    for (const part of parts) {
      if ("n03" in part) {
        rows.push({ source: "n03", version: SOURCE_VERSIONS.n03, code: part.n03 });
        continue;
      }
      const feats = estat[part.estat]?.features ?? [];
      const hit = feats.filter((f) => {
        if ("names" in part) return part.names.includes(String(f.properties.S_NAME));
        const head = Number(String(f.properties.S_AREA).slice(0, 3));
        return head >= part.codeRange[0] && head <= part.codeRange[1];
      });
      const codes = [...new Set(hit.map((f) => String(f.properties.KEY_CODE)))].sort();
      if (codes.length === 0) throw new Error(`小地域が見つかりません: ${id} ${JSON.stringify(part)}`);
      for (const code of codes) rows.push({ source: "estat", version: SOURCE_VERSIONS.estat, code });
    }
    out.set(id, rows);
  }
  // 1 つのコードが 2 つのエリアに入らないこと
  const seen = new Map<string, string>();
  for (const [id, rows] of out) {
    for (const r of rows) {
      const k = `${r.source}:${r.code}`;
      if (seen.has(k)) throw new Error(`同じ材料が 2 つのエリアにあります: ${k}（${seen.get(k)} と ${id}）`);
      seen.set(k, id);
    }
  }
  return out;
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function seedSql(parts: Map<string, RegionPart[]>, points: Record<string, [number, number]>): string {
  const rows = [...parts].flatMap(([id, rs]) => rs.map((r) => `  (${lit(id)}, ${lit(r.source)}, ${lit(r.version)}, ${lit(r.code)})`));
  const pts = Object.entries(points).map(([id, [lng, lat]]) => `update public.regions set lat = ${lat}, lng = ${lng} where id = ${lit(id)};`);
  return [
    "-- region_parts の初期行：以前コードに手書きしていたエリアの作り方を 1 コード 1 行に展開したもの（scripts/area-map/seed-parts.ts で生成）",
    "insert into public.region_parts (region_id, source, source_version, code) values",
    rows.join(",\n"),
    "on conflict do nothing;",
    "",
    "-- 区画の無いエリアの位置",
    ...pts,
    "",
  ].join("\n");
}

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("使い方: node scripts/area-map/seed-parts.ts <migration の .sql>");
  const cities = [...new Set(Object.values(AREA_PARTS).flatMap((ps) => ps.flatMap((p) => ("estat" in p ? [p.estat] : []))))];
  const files = await fetchSources(cities);
  const estat: Record<string, FeatureCollection> = {};
  for (const c of cities) estat[c] = fc((await run(`-i ${q(files.estat[c])} encoding=sjis`)).features);
  fs.writeFileSync(out, seedSql(expandParts(AREA_PARTS, estat), AREA_POINTS));
  console.log(`wrote ${out}`);
}

if (process.argv[1]?.endsWith("seed-parts.ts")) await main();
