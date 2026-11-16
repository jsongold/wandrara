// 位置の索引（都道府県ごと）と manifest を作る（純関数）。判定用なので簡略化・隙間埋めはしない（座標は 5 桁に丸めるだけ）
import { createHash } from "node:crypto";
import type { BBox, LookupManifest, LookupShard, MultiPolygon, RegionDef } from "../../src/lib/region/types.ts";
import type { Feature } from "./parts.ts";
import { cityOfKeyCode, SOURCE_VERSIONS } from "./sources.ts";

const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** Polygon / MultiPolygon の地物を MultiPolygon にまとめる（座標は 5 桁） */
export function toMulti(features: Feature[]): MultiPolygon {
  const out: MultiPolygon = [];
  for (const f of features) {
    const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] } | null;
    if (!g) continue;
    const polys = (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []) as number[][][][];
    for (const p of polys) out.push(p.map((ring) => ring.map(([x, y]) => [r5(x), r5(y)] as [number, number])));
  }
  return out;
}

export function bboxOf(shapes: MultiPolygon[]): BBox | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const m of shapes) for (const p of m) for (const [x, y] of p[0] ?? []) {
    w = Math.min(w, x); s = Math.min(s, y); e = Math.max(e, x); n = Math.max(n, y);
  }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

export type LookupInput = {
  defs: RegionDef[];
  n03: Feature[]; // 定義が使う市区町村の N03 の地物（元の形）
  estat: Record<string, Feature[]>; // 市区町村コード → 小地域の地物（元の形）
};

export function buildLookup({ defs, n03, estat }: LookupInput): { shards: LookupShard[]; manifest: LookupManifest } {
  const prefs = new Map<string, { name: string; shard: LookupShard }>();
  const shardOf = (city: string) => {
    const code = city.slice(0, 2);
    let p = prefs.get(code);
    if (!p) {
      const name = String(n03.find((f) => String(f.properties.N03_007).startsWith(code))?.properties.N03_001 ?? code);
      p = { name, shard: { prefecture: code, municipalities: [], areas: [], codeAreas: {} } };
      prefs.set(code, p);
    }
    return p.shard;
  };

  // 市区町村
  const cities = [...new Set(n03.map((f) => String(f.properties.N03_007)))].sort();
  for (const code of cities) {
    const fs = n03.filter((f) => f.properties.N03_007 === code);
    const p = fs[0].properties;
    const name = `${p.N03_004 ?? ""}${p.N03_005 ?? ""}`;
    shardOf(code).municipalities.push({ code, name, shape: toMulti(fs) });
  }

  // エリア自身の材料（県ごとに分ける）
  for (const d of defs) {
    const byPref = new Map<string, { municipalities: string[]; features: Feature[] }>();
    for (const part of d.parts) {
      const city = part.source === "n03" ? part.code : cityOfKeyCode(part.code);
      const shard = shardOf(city);
      const e = byPref.get(shard.prefecture) ?? { municipalities: [], features: [] };
      byPref.set(shard.prefecture, e);
      if (part.source === "n03") e.municipalities.push(part.code);
      else e.features.push(...(estat[city] ?? []).filter((f) => f.properties.KEY_CODE === part.code));
      const ca = (shard.codeAreas[city] ??= []);
      if (!ca.includes(d.id)) ca.push(d.id);
    }
    for (const [pref, e] of byPref) {
      prefs.get(pref)!.shard.areas.push({ id: d.id, municipalities: e.municipalities.sort(), shape: toMulti(e.features) });
    }
  }

  const shards = [...prefs.values()].map((p) => p.shard).sort((a, b) => (a.prefecture < b.prefecture ? -1 : 1));
  const parents = Object.fromEntries(defs.map((d) => [d.id, d.parentId]));
  const hash = createHash("sha256").update(JSON.stringify({ shards, parents, points: defs.map((d) => [d.id, d.point]), SOURCE_VERSIONS })).digest("hex").slice(0, 12);
  const manifest: LookupManifest = {
    version: `lookup-${hash}`,
    sources: SOURCE_VERSIONS,
    prefectures: shards.map((s) => ({
      code: s.prefecture,
      name: prefs.get(s.prefecture)!.name,
      bbox: bboxOf(s.municipalities.map((m) => m.shape).concat(s.areas.map((a) => a.shape))) ?? [0, 0, 0, 0],
    })),
    parents,
    points: defs.filter((d) => d.parts.length === 0 && d.point).map((d) => d.id),
  };
  return { shards, manifest };
}
