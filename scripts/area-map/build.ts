// エリア地図のデータを作る。元データは .cache/area-map/ に落とす（コミットしない）。
// 出力は src/generated/area-map/<地図 id>.json と、それを読む index.ts（コミットする）。
// 使い方: pnpm area-map:build

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import mapshaper from "mapshaper";
import type { AreaMapData } from "../../src/lib/area-map.ts";
import { AREA_PARTS, AREA_POINTS, estatUrl, MAPS, N03_BASENAME, N03_URL, type MapDef } from "./areas.ts";
import { featuresFor, sourceCodes, type FeatureCollection, type Sources } from "./parts.ts";
import { makeProjection, pathOf, type Geometry } from "./project.ts";

const CACHE = path.resolve(".cache/area-map");
const OUT = path.resolve("src/generated/area-map");
const WIDTH = 360;

async function download(url: string, dir: string): Promise<void> {
  if (fs.existsSync(dir)) return;
  console.log(`download ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ダウンロードに失敗しました: ${res.status} ${url}`);
  fs.mkdirSync(CACHE, { recursive: true });
  const zip = `${dir}.zip`;
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-oq", zip, "-d", dir]);
  fs.rmSync(zip);
}

async function fetchSources(estatCodes: string[]): Promise<{ n03: string; estat: Record<string, string> }> {
  const n03Dir = path.join(CACHE, "n03");
  await download(N03_URL, n03Dir);
  const estat: Record<string, string> = {};
  for (const code of estatCodes) {
    const dir = path.join(CACHE, `estat-${code}`);
    await download(estatUrl(code), dir);
    estat[code] = path.join(dir, `r2ka${code}.shp`);
  }
  return { n03: path.join(n03Dir, `${N03_BASENAME}.shp`), estat };
}

async function run(cmd: string, input?: Record<string, string>): Promise<FeatureCollection> {
  const out = await mapshaper.applyCommands(`${cmd} -o format=geojson out.json`, input);
  const g = JSON.parse(String(out["out.json"]));
  if (g.type === "GeometryCollection") {
    return { type: "FeatureCollection", features: g.geometries.map((geometry: unknown) => ({ type: "Feature", properties: {}, geometry })) };
  }
  return g;
}

const q = (s: string) => `'${s}'`;

async function landOf(map: MapDef, n03: string): Promise<FeatureCollection> {
  const simp = `-simplify interval=${map.interval} keep-shapes`;
  if (map.land === "prefectures") {
    return run(`-i ${q(n03)} -dissolve N03_001 ${simp} -filter-islands min-area=5km2 remove-empty`);
  }
  return run(`-i ${q(n03)} -clip bbox=${map.bbox.join(",")} -dissolve ${simp} -filter-islands min-area=0.3km2 remove-empty`);
}

async function buildMap(map: MapDef, files: { n03: string; estat: Record<string, string> }): Promise<AreaMapData> {
  const pr = makeProjection(map.bbox, WIDTH);
  const land = await landOf(map, files.n03);

  const linkShapes = (map.links ?? []).flatMap((l) => (l.shape ? [l.shape] : []));
  const ids = [...(map.shapes ?? []), ...linkShapes];
  const shapes = new Map<string, { d: string; label: [number, number] }>();
  if (ids.length > 0) {
    const codes = sourceCodes(ids, AREA_PARTS);
    const n03Filter = `-filter ${q(`${JSON.stringify(codes.n03)}.includes(N03_007)`)}`;
    const src: Sources = {
      n03: await run(`-i ${q(files.n03)} -clip bbox=${map.bbox.join(",")} ${n03Filter}`),
      estat: {},
    };
    for (const code of codes.estat) src.estat[code] = await run(`-i ${q(files.estat[code])} encoding=sjis`);
    const combined = JSON.stringify({ type: "FeatureCollection", features: featuresFor(ids, AREA_PARTS, src) });
    const dissolved = await run(
      `-i a.json -dissolve area -simplify interval=${map.interval} keep-shapes -filter-islands min-area=0.05km2 remove-empty`,
      { "a.json": combined },
    );
    const labels = await run(`-i a.json -points inner`, { "a.json": JSON.stringify(dissolved) });
    for (const f of dissolved.features) {
      const id = String(f.properties.area);
      const p = labels.features.find((l) => l.properties.area === id)?.geometry as { coordinates: [number, number] } | undefined;
      shapes.set(id, { d: pathOf(f.geometry as Geometry, pr), label: p ? pr.project(p.coordinates) : [0, 0] });
    }
  }

  const shape = (id: string) => {
    const s = shapes.get(id);
    if (!s) throw new Error(`形を作れませんでした: ${id}`);
    return s;
  };
  return {
    id: map.id,
    name: map.name,
    viewBox: pr.viewBox,
    land: land.features.map((f) => pathOf(f.geometry as Geometry, pr)).join(""),
    shapes: (map.shapes ?? []).map((id) => ({ id, ...shape(id) })),
    points: (map.points ?? []).map((id) => ({ id, at: pr.project(AREA_POINTS[id]) })),
    links: (map.links ?? []).map((l) => {
      const target = MAPS.find((m) => m.id === l.map);
      if (!target) throw new Error(`寄る先の地図がありません: ${l.map}`);
      if (l.shape) return { map: l.map, name: target.name, d: shape(l.shape).d, at: shape(l.shape).label };
      if (!l.at) throw new Error(`寄る先の位置がありません: ${l.map}`);
      return { map: l.map, name: target.name, at: pr.project(l.at) };
    }),
    wholes: map.wholes ?? [],
  };
}

async function main() {
  const allIds = MAPS.flatMap((m) => [...(m.shapes ?? []), ...(m.links ?? []).flatMap((l) => (l.shape ? [l.shape] : []))]);
  const files = await fetchSources(sourceCodes(allIds, AREA_PARTS).estat);
  fs.mkdirSync(OUT, { recursive: true });
  for (const map of MAPS) {
    const data = await buildMap(map, files);
    const json = JSON.stringify(data);
    fs.writeFileSync(path.join(OUT, `${map.id}.json`), json + "\n");
    console.log(`${map.id}.json  ${(json.length / 1024).toFixed(1)}KB (gzip ${(gzipSync(json).length / 1024).toFixed(1)}KB)`);
  }
  const loaders = MAPS.map((m) => `  ${JSON.stringify(m.id)}: () => import("./${m.id}.json").then((m) => m.default as unknown as AreaMapData),`).join("\n");
  fs.writeFileSync(
    path.join(OUT, "index.ts"),
    `// 生成ファイル（pnpm area-map:build）。手で直さない\nimport type { AreaMapData } from "@/lib/area-map";\n\nexport const AREA_MAP_LOADERS: Record<string, () => Promise<AreaMapData>> = {\n${loaders}\n};\n`,
  );
}

await main();
