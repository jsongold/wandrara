// エリア地図のデータと位置の索引を、ローカル DB のエリアの定義（regions・region_parts）から作る。
// 元データは .cache/area-map/ に落とす（コミットしない）。出力はコミットする：
//   src/generated/area-map/<地図 id>.json と index.ts（画面用。段ごとの SVG path）
//   src/generated/region-lookup/<県>.ts・manifest.ts・index.ts（取り込み用。判定用の形）
// 使い方: supabase db reset → pnpm area-map:build

import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { AreaMapData } from "../../src/lib/area-map.ts";
import { CHIHO } from "../../src/lib/region/chiho.ts";
import type { BBox, RegionDef } from "../../src/lib/region/types.ts";
import { loadDefinitions, mappable } from "./definitions.ts";
import { citiesOf, fc, featuresOf, q, run, type Feature, type FeatureCollection, type Sources } from "./parts.ts";
import { makeProjection, pathOf, type Geometry } from "./project.ts";
import { fetchSources, type SourceFiles } from "./sources.ts";
import { deriveMapTree, type MapDef } from "./tree.ts";
import { bboxOf, buildLookup, toMulti } from "./write.ts";

const MAP_OUT = path.resolve("src/generated/area-map");
const LOOKUP_OUT = path.resolve("src/generated/region-lookup");
const WIDTH = 360;
const LOOKUP_INTERVAL = 10;
const HEADER = "// 生成ファイル（pnpm area-map:build）。手で直さない\n";

type Shapes = {
  cover: Map<string, Feature[]>; // エリア全体（自分＋子孫の材料）
  display: Map<string, Feature[]>; // 地図で押せる形：子のある親は子に入らない残り、ほかは全体
};

async function landOf(map: MapDef, n03: string): Promise<FeatureCollection> {
  const simp = `-simplify interval=${map.interval} keep-shapes`;
  if (map.land === "prefectures") {
    return run(`-i ${q(n03)} -dissolve N03_001 ${simp} -filter-islands min-area=5km2 remove-empty`);
  }
  return run(`-i ${q(n03)} -clip bbox=${map.bbox.join(",")} -dissolve ${simp} -filter-islands min-area=0.3km2 remove-empty`);
}

/** 地方の形（都道府県をまとめたもの） */
async function chihoShape(id: string, n03: string, interval: number): Promise<FeatureCollection> {
  const c = CHIHO.find((x) => x.id === id);
  if (!c) throw new Error(`地方がありません: ${id}`);
  const filter = `-filter ${q(`Number(N03_007.slice(0,2)) >= ${c.prefectures[0]} && Number(N03_007.slice(0,2)) <= ${c.prefectures[1]}`)}`;
  return run(`-i ${q(n03)} ${filter} -dissolve -simplify interval=${interval} keep-shapes -filter-islands min-area=5km2 remove-empty`);
}

async function buildShapes(defs: RegionDef[], src: Sources): Promise<Shapes> {
  const own = new Map(defs.map((d) => [d.id, featuresOf(d.id, d.parts, src)]));
  const descendants = (id: string): string[] => defs.filter((d) => d.parentId === id).flatMap((d) => [d.id, ...descendants(d.id)]);
  const cover = new Map<string, Feature[]>();
  const display = new Map<string, Feature[]>();
  for (const d of defs) {
    const kids = descendants(d.id);
    const all = [d.id, ...kids].flatMap((id) => own.get(id) ?? []).map((f) => ({ ...f, properties: { area: d.id } }));
    cover.set(d.id, all);
    const mine = own.get(d.id) ?? [];
    if (kids.length === 0 || mine.length === 0) {
      display.set(d.id, all);
      continue;
    }
    const kidFeatures = kids.flatMap((id) => own.get(id) ?? []);
    const rest = kidFeatures.length
      ? await run(`-i own.json -erase kids.json`, { "own.json": JSON.stringify(fc(mine)), "kids.json": JSON.stringify(fc(kidFeatures)) })
      : fc(mine);
    display.set(d.id, rest.features.map((f) => ({ ...f, properties: { area: d.id } })));
  }
  return { cover, display };
}

async function buildMap(map: MapDef, maps: MapDef[], defs: RegionDef[], shapes: Shapes, files: SourceFiles): Promise<AreaMapData> {
  const pr = makeProjection(map.bbox, WIDTH);
  const land = await landOf(map, files.n03);
  const byId = new Map(defs.map((d) => [d.id, d]));

  // 押せる形とリンクの形をまとめて簡略化する（キーは "s:<id>" か "l:<id>"）
  const feats: Feature[] = [
    ...map.shapes.flatMap((id) => (shapes.display.get(id) ?? []).map((f) => ({ ...f, properties: { key: `s:${id}` } }))),
    ...map.links.flatMap((l) => (l.shape ? (shapes.cover.get(l.shape) ?? []).map((f) => ({ ...f, properties: { key: `l:${l.shape}` } })) : [])),
  ];
  const got = new Map<string, { d: string; label: [number, number] }>();
  const addAll = async (fcIn: FeatureCollection, keyOf: (f: Feature) => string) => {
    const labels = await run(`-i a.json -points inner`, { "a.json": JSON.stringify(fcIn) });
    for (const f of fcIn.features) {
      const key = keyOf(f);
      const p = labels.features.find((l) => keyOf(l) === key)?.geometry as { coordinates: [number, number] } | undefined;
      got.set(key, { d: pathOf(f.geometry as Geometry, pr), label: p ? pr.project(p.coordinates) : [0, 0] });
    }
  };
  if (feats.length > 0) {
    const dissolved = await run(
      `-i a.json -dissolve key -simplify interval=${map.interval} keep-shapes -filter-islands min-area=0.05km2 remove-empty`,
      { "a.json": JSON.stringify(fc(feats)) },
    );
    await addAll(dissolved, (f) => String(f.properties.key));
  }
  for (const l of map.links) {
    if (l.chiho) {
      const c = await chihoShape(l.chiho, files.n03, map.interval);
      await addAll(fc(c.features.map((f) => ({ ...f, properties: { key: `c:${l.chiho}` } }))), (f) => String(f.properties.key));
    }
  }

  const shape = (key: string) => {
    const s = got.get(key);
    if (!s || !s.d) throw new Error(`形を作れませんでした: ${map.id} ${key}`);
    return s;
  };
  return {
    id: map.id,
    name: map.name,
    viewBox: pr.viewBox,
    ...(map.start ? { start: viewOf(map.start, pr.project) } : {}),
    land: land.features.map((f) => pathOf(f.geometry as Geometry, pr)).join(""),
    shapes: map.shapes.map((id) => ({ id, ...shape(`s:${id}`) })),
    points: map.points.map((id) => {
      const p = byId.get(id)?.point;
      if (!p) throw new Error(`点の位置がありません: ${id}`);
      return { id, at: pr.project(p) };
    }),
    links: map.links.map((l) => {
      const target = maps.find((m) => m.id === l.map);
      if (!target) throw new Error(`寄る先の地図がありません: ${l.map}`);
      const s = shape(l.shape ? `l:${l.shape}` : `c:${l.chiho}`);
      return { map: l.map, name: target.name, d: s.d, at: s.label };
    }),
    wholes: map.wholes,
  };
}

/** 緯度経度の範囲を、SVG の viewBox（"x y w h"）にする */
function viewOf(b: BBox, project: (p: [number, number]) => [number, number]): string {
  const [x0, y0] = project([b[0], b[3]]);
  const [x1, y1] = project([b[2], b[1]]);
  return `${x0} ${y0} ${Math.round((x1 - x0) * 10) / 10} ${Math.round((y1 - y0) * 10) / 10}`;
}

const write = (file: string, body: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};

async function main() {
  const all = await loadDefinitions();
  const defs = mappable(all);
  for (const d of all.filter((x) => !defs.includes(x))) console.warn(`地図に出せない（材料も点も無い）: ${d.id}`);
  for (const d of defs) if (!d.name.en || d.name.en === d.id || d.name.ja === d.id) console.warn(`名前が足りない（en が無い・名前が id のまま）: ${d.id}`);

  const allParts = defs.flatMap((d) => d.parts);
  const cities = citiesOf(allParts);
  const files = await fetchSources(cities.estat);
  const n03Filter = `-filter ${q(`${JSON.stringify(cities.all)}.includes(N03_007)`)}`;
  // 判定用の形は 10m 間隔だけ簡略化する（境界の誤差は 10m ほど。同じ層の中の境界は共有されたまま動く）
  const fine = `-simplify interval=${LOOKUP_INTERVAL} keep-shapes`;
  const src: Sources = { n03: await run(`-i ${q(files.n03)} ${n03Filter} ${fine}`), estat: {} };
  for (const c of cities.estat) src.estat[c] = await run(`-i ${q(files.estat[c])} encoding=sjis ${fine}`);

  const shapes = await buildShapes(defs, src);
  const bbox = new Map<string, BBox>();
  const regionCities = new Map<string, string[]>();
  for (const d of defs) {
    const b = bboxOf([toMulti(shapes.cover.get(d.id) ?? [])]);
    if (b) bbox.set(d.id, b);
    else if (d.point) bbox.set(d.id, [d.point[0], d.point[1], d.point[0], d.point[1]]);
    const kids = defs.filter((k) => k.parentId === d.id);
    regionCities.set(d.id, citiesOf([d, ...kids].flatMap((x) => x.parts)).all);
  }
  const maps = deriveMapTree({ defs, bbox, cities: regionCities });

  // 画面用の地図
  fs.rmSync(MAP_OUT, { recursive: true, force: true });
  for (const map of maps) {
    const json = JSON.stringify(await buildMap(map, maps, defs, shapes, files));
    write(path.join(MAP_OUT, `${map.id}.json`), json + "\n");
    console.log(`area-map/${map.id}.json  ${(json.length / 1024).toFixed(1)}KB (gzip ${(gzipSync(json).length / 1024).toFixed(1)}KB)`);
  }
  const loaders = maps.map((m) => `  ${JSON.stringify(m.id)}: () => import("./${m.id}.json").then((m) => m.default as unknown as AreaMapData),`).join("\n");
  write(
    path.join(MAP_OUT, "index.ts"),
    `${HEADER}import type { AreaMapData } from "@/lib/area-map";\n\nexport const AREA_MAP_LOADERS: Record<string, () => Promise<AreaMapData>> = {\n${loaders}\n};\n`,
  );

  // 取り込み用の索引
  const { shards, manifest } = buildLookup({ defs, n03: src.n03.features, estat: Object.fromEntries(Object.entries(src.estat).map(([k, v]) => [k, v.features])) });
  fs.rmSync(LOOKUP_OUT, { recursive: true, force: true });
  const typeImport = `import type { LookupManifest, LookupShard } from "../../lib/region/types.ts";\n\n`;
  for (const s of shards) {
    const body = `${HEADER}${typeImport}const shard: LookupShard = ${JSON.stringify(s)};\nexport default shard;\n`;
    write(path.join(LOOKUP_OUT, `${s.prefecture}.ts`), body);
    console.log(`region-lookup/${s.prefecture}.ts  ${(body.length / 1024).toFixed(1)}KB`);
  }
  write(path.join(LOOKUP_OUT, "manifest.ts"), `${HEADER}${typeImport}export const LOOKUP_MANIFEST: LookupManifest = ${JSON.stringify(manifest, null, 2)};\n`);
  const shardLoaders = shards.map((s) => `  ${JSON.stringify(s.prefecture)}: () => import("./${s.prefecture}.ts").then((m) => m.default),`).join("\n");
  write(
    path.join(LOOKUP_OUT, "index.ts"),
    `${HEADER}${typeImport}export { LOOKUP_MANIFEST } from "./manifest.ts";\n\n/** 都道府県コード → 索引（必要な県だけ読む） */\nexport const LOOKUP_LOADERS: Record<string, () => Promise<LookupShard>> = {\n${shardLoaders}\n};\n`,
  );
  // 同じ定義なら同じ出力になるように、生成物に日時は入れない
  console.log(`lookup ${manifest.version}`);
}

await main();
