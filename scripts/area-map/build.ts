// エリア地図のデータと位置の索引を、ローカル DB のエリアの定義（regions・region_parts）から作る。
// 元データは .cache/area-map/ に落とす（コミットしない）。出力はコミットする：
//   src/generated/area-map/base.json・children/<親 id>.json・index.ts（画面用。1 枚の地図の SVG path）
//   src/generated/region-lookup/<県>.ts・manifest.ts・index.ts（取り込み用。判定用の形）
// 使い方: supabase db reset → pnpm area-map:build

import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { AreaMapBase, AreaMapChildren, Box, MapArea } from "../../src/lib/area-map.ts";
import type { BBox, RegionDef } from "../../src/lib/region/types.ts";
import { loadDefinitions, mappable } from "./definitions.ts";
import { citiesOf, fc, featuresOf, q, run, type Feature, type Sources } from "./parts.ts";
import { areaOf, makeProjection, pathOf, type Geometry, type Projection } from "./project.ts";
import { fetchSources, SOURCE_VERSIONS } from "./sources.ts";
import { intervalFor, JAPAN_BBOX, JAPAN_START, pad, planSheet } from "./tree.ts";
import { bboxOf, buildLookup, toMulti } from "./write.ts";

const MAP_OUT = path.resolve("src/generated/area-map");
const LOOKUP_OUT = path.resolve("src/generated/region-lookup");
const WIDTH = 2000; // 全国の幅。座標は 0.1 単位に丸める（約 80m）
const LOOKUP_INTERVAL = 10;
const LAND_INTERVAL = 100;
const LAND_DRAW_INTERVAL = 2500; // 背景の陸地（都道府県の輪郭）
const PARENT_INTERVAL = 800; // 親エリアの形
const HEADER = "// 生成ファイル（pnpm area-map:build）。手で直さない\n";

type Shapes = {
  cover: Map<string, Feature[]>; // エリア全体（自分＋子孫の材料）
  display: Map<string, Feature[]>; // 地図で押せる形：子のある親は子に入らない残り、ほかは全体
};

/**
 * 背景の陸地と地方の形に使う、100m 間隔に簡略化した N03 全国（GeoJSON）。一度作って .cache に置き、地図ごとに読み直す元データを軽くする
 * （全国のエリアでは地図が数百になり、毎回 450MB の shp を読むと終わらない）
 */
async function landBaseOf(n03: string): Promise<string> {
  const out = path.resolve(".cache/area-map", `${SOURCE_VERSIONS.n03}-land-${LAND_INTERVAL}m.json`);
  if (!fs.existsSync(out)) {
    console.log(`land base ${path.basename(out)}`);
    const fc = await run(`-i ${q(n03)} -each ${q("N03_007 = N03_007, N03_001 = N03_001")} -simplify interval=${LAND_INTERVAL} keep-shapes`);
    fs.writeFileSync(out, JSON.stringify({ type: "FeatureCollection", features: fc.features.map((f) => ({ ...f, properties: { N03_001: f.properties.N03_001, N03_007: f.properties.N03_007 } })) }));
  }
  return out;
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

/** 形をキーごとにまとめて簡略化し、path・ラベル位置・範囲・面積にする（キーは properties.key） */
async function areasOf(feats: Feature[], interval: number, minIsland: string, pr: Projection): Promise<Map<string, Omit<MapArea, "id">>> {
  const out = new Map<string, Omit<MapArea, "id">>();
  if (feats.length === 0) return out;
  const dissolved = await run(
    `-i a.json -dissolve key -simplify interval=${interval} keep-shapes -filter-islands min-area=${minIsland} remove-empty`,
    { "a.json": JSON.stringify(fc(feats)) },
  );
  const labels = await run(`-i a.json -points inner`, { "a.json": JSON.stringify(dissolved) });
  for (const f of dissolved.features) {
    const key = String(f.properties.key);
    const g = f.geometry as Geometry;
    const d = pathOf(g, pr);
    if (!d) continue;
    const p = labels.features.find((l) => String(l.properties.key) === key)?.geometry as { coordinates: [number, number] } | undefined;
    const b = bboxOf([toMulti([f])]);
    if (!b) continue;
    const [x0, y0] = pr.project([b[0], b[3]]);
    const [x1, y1] = pr.project([b[2], b[1]]);
    const box: Box = [x0, y0, Math.round((x1 - x0) * 10) / 10, Math.round((y1 - y0) * 10) / 10];
    out.set(key, { d, label: p ? pr.project(p.coordinates) : [x0 + box[2] / 2, y0 + box[3] / 2], box, size: areaOf(g, pr) });
  }
  return out;
}

const keyed = (fs: Feature[], key: string): Feature[] => fs.map((f) => ({ ...f, properties: { key } }));

async function buildSheet(defs: RegionDef[], shapes: Shapes, landBase: string, bbox: Map<string, BBox>) {
  const pr = makeProjection(JAPAN_BBOX, WIDTH);
  const plan = planSheet(defs, (id) => (shapes.cover.get(id) ?? []).length > 0);
  const land = await run(`-i ${q(landBase)} -dissolve N03_001 -simplify interval=${LAND_DRAW_INTERVAL} keep-shapes -filter-islands min-area=3km2 remove-empty`);
  const parentAreas = await areasOf(plan.parents.flatMap((id) => keyed(shapes.cover.get(id) ?? [], id)), PARENT_INTERVAL, "1km2", pr);
  const need = (m: Map<string, Omit<MapArea, "id">>, id: string) => {
    const a = m.get(id);
    if (!a) throw new Error(`形を作れませんでした: ${id}`);
    return { id, ...a };
  };
  const base: AreaMapBase = {
    viewBox: pr.viewBox,
    start: viewOf(JAPAN_START, pr.project),
    land: land.features.map((f) => pathOf(f.geometry as Geometry, pr)).join(""),
    parents: plan.parents.filter((id) => parentAreas.has(id) || (console.warn(`地図に形を出せない（小さすぎる・範囲の外）: ${id}`), false)).map((id) => need(parentAreas, id)),
  };
  const byId = new Map(defs.map((d) => [d.id, d]));
  const children: AreaMapChildren[] = [];
  for (const c of plan.children) {
    const b = bbox.get(c.parent);
    const interval = b ? intervalFor(pad(b, 0.08)) : 250;
    const areas = await areasOf(c.shapes.flatMap((id) => keyed(shapes.display.get(id) ?? [], id)), interval, "0.05km2", pr);
    children.push({
      parent: c.parent,
      shapes: c.shapes.filter((id) => areas.has(id)).map((id) => need(areas, id)),
      points: c.points.map((id) => {
        const p = byId.get(id)?.point;
        if (!p) throw new Error(`点の位置がありません: ${id}`);
        return { id, at: pr.project(p) };
      }),
    });
  }
  return { base, children };
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

  const landBase = await landBaseOf(files.n03);
  const shapes = await buildShapes(defs, src);
  const bbox = new Map<string, BBox>();
  for (const d of defs) {
    const b = bboxOf([toMulti(shapes.cover.get(d.id) ?? [])]);
    if (b) bbox.set(d.id, b);
    else if (d.point) bbox.set(d.id, [d.point[0], d.point[1], d.point[0], d.point[1]]);
  }
  const sheet = await buildSheet(defs, shapes, landBase, bbox);

  // 画面用の地図
  fs.rmSync(MAP_OUT, { recursive: true, force: true });
  const report = (name: string, json: string) => console.log(`area-map/${name}  ${(json.length / 1024).toFixed(1)}KB (gzip ${(gzipSync(json).length / 1024).toFixed(1)}KB)`);
  const baseJson = JSON.stringify(sheet.base);
  write(path.join(MAP_OUT, "base.json"), baseJson + "\n");
  report("base.json", baseJson);
  for (const c of sheet.children) {
    const json = JSON.stringify(c);
    write(path.join(MAP_OUT, "children", `${c.parent}.json`), json + "\n");
    report(`children/${c.parent}.json`, json);
  }
  const loaders = sheet.children.map((c) => `  ${JSON.stringify(c.parent)}: () => import("./children/${c.parent}.json").then((m) => m.default as unknown as AreaMapChildren),`).join("\n");
  write(
    path.join(MAP_OUT, "index.ts"),
    `${HEADER}import type { AreaMapBase, AreaMapChildren } from "@/lib/area-map";\n\nexport const loadAreaMapBase = (): Promise<AreaMapBase> => import("./base.json").then((m) => m.default as unknown as AreaMapBase);\n\n/** 親エリア id → その子の形（寄せたときに読む） */\nexport const AREA_MAP_CHILDREN: Record<string, () => Promise<AreaMapChildren>> = {\n${loaders}\n};\n`,
  );

  // 取り込み用の索引
  const { shards, manifest } = buildLookup({ defs, n03: src.n03.features, estat: Object.fromEntries(Object.entries(src.estat).map(([k, v]) => [k, v.features])) });
  fs.rmSync(LOOKUP_OUT, { recursive: true, force: true });
  const typeImport = (t: string) => `import type { ${t} } from "../../lib/region/types.ts";\n\n`;
  for (const s of shards) {
    const body = `${HEADER}${typeImport("LookupShard")}const shard: LookupShard = ${JSON.stringify(s)};\nexport default shard;\n`;
    write(path.join(LOOKUP_OUT, `${s.prefecture}.ts`), body);
    console.log(`region-lookup/${s.prefecture}.ts  ${(body.length / 1024).toFixed(1)}KB`);
  }
  write(path.join(LOOKUP_OUT, "manifest.ts"), `${HEADER}${typeImport("LookupManifest")}export const LOOKUP_MANIFEST: LookupManifest = ${JSON.stringify(manifest, null, 2)};\n`);
  const shardLoaders = shards.map((s) => `  ${JSON.stringify(s.prefecture)}: () => import("./${s.prefecture}.ts").then((m) => m.default),`).join("\n");
  write(
    path.join(LOOKUP_OUT, "index.ts"),
    `${HEADER}${typeImport("LookupShard")}export { LOOKUP_MANIFEST } from "./manifest.ts";\n\n/** 都道府県コード → 索引（必要な県だけ読む） */\nexport const LOOKUP_LOADERS: Record<string, () => Promise<LookupShard>> = {\n${shardLoaders}\n};\n`,
  );
  // 同じ定義なら同じ出力になるように、生成物に日時は入れない
  console.log(`lookup ${manifest.version}`);
}

await main();
