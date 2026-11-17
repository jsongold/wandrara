// 点のまわりの地図（SVG の線・面）と近くの場所を、spec（spec.ts）のとおりに作る。データの取得はしない（fetch.ts）。
// 座標はズーム 14 の「世界座標」（区画 1 つ = EXTENT 単位）。画面の SVG は viewBox 0..W × 0..H。
import type { Locale } from "../types";
import { PATH_LAYERS, PLACES, type PathPart, type PlaceKey } from "./layers";
import type { NearbySpec } from "./spec";

export const ZOOM = 14;
export const EXTENT = 4096;
/** 地図の枠の大きさ（viewBox）。カードの中で横長に出す */
export const W = 632;
export const H = 300;

export type Pt = { x: number; y: number };
/** 区画から取り出した 1 件。geometry は世界座標。type: 1=点 2=線 3=面 */
export type MapFeature = { layer: string; type: number; props: Record<string, unknown>; geometry: Pt[][] };

export type NearbyPlace = { name: string; distanceM: number; x: number; y: number; inView: boolean };
export type Nearby = {
  paths: (PathPart & { d: string })[];
  point: Pt;
  places: { kind: PlaceKey; items: NearbyPlace[] }[];
};

/** spec で読む区画の層 */
export function sourcesOf(spec: NearbySpec): string[] {
  return [...new Set([...spec.layers.flatMap((k) => PATH_LAYERS[k].sources), ...spec.places.flatMap((p) => PLACES[p.kind].sources)])];
}

/** 緯度経度 → ズーム 14 の世界座標 */
export function toWorld(lat: number, lng: number): Pt {
  const n = 2 ** ZOOM * EXTENT;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

/** 枠を埋めるのに要る区画（点のいる区画と、点に近い側の隣の区画で 2×2） */
export function tilesAround(lat: number, lng: number): { x: number; y: number }[] {
  const p = toWorld(lat, lng);
  const tx = Math.floor(p.x / EXTENT);
  const ty = Math.floor(p.y / EXTENT);
  const dx = p.x / EXTENT - tx < 0.5 ? -1 : 1;
  const dy = p.y / EXTENT - ty < 0.5 ? -1 : 1;
  return [
    { x: tx, y: ty },
    { x: tx + dx, y: ty },
    { x: tx, y: ty + dy },
    { x: tx + dx, y: ty + dy },
  ];
}

/** 世界座標 → 枠の座標の変換と、枠に掛かるかの判定 */
function viewOf(center: Pt, spanTiles: number) {
  const span = spanTiles * EXTENT;
  const k = W / span;
  const x0 = center.x - span / 2;
  const y0 = center.y - (H / k) / 2;
  const tx = (p: Pt): Pt => ({ x: (p.x - x0) * k, y: (p.y - y0) * k });
  return { tx, inView: (p: Pt) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H };
}

const MARGIN = 40;
/** 線を間引く（Douglas-Peucker）。tol は枠の座標で */
export function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  let maxD = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = len === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
    if (d > maxD) [maxD, idx] = [d, i];
  }
  if (maxD <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

const TOL = 1;
const inBox = (p: Pt) => p.x >= -MARGIN && p.x <= W + MARGIN && p.y >= -MARGIN && p.y <= H + MARGIN;
const clamp = (p: Pt): Pt => ({ x: Math.min(W + MARGIN, Math.max(-MARGIN, p.x)), y: Math.min(H + MARGIN, Math.max(-MARGIN, p.y)) });

/** 線は枠（と少しの余白）に掛かる区間だけに分ける。面は頂点を余白の端に寄せる */
function cropRings(rings: Pt[][], closed: boolean): Pt[][] {
  if (closed) return rings.map((r) => r.map(clamp));
  const out: Pt[][] = [];
  for (const r of rings) {
    let cur: Pt[] = [];
    r.forEach((p, i) => {
      const keep = inBox(p) || (i > 0 && inBox(r[i - 1])) || (i < r.length - 1 && inBox(r[i + 1]));
      if (keep) cur.push(p);
      else if (cur.length) {
        out.push(cur);
        cur = [];
      }
    });
    if (cur.length) out.push(cur);
  }
  return out;
}

/** 線を SVG の d にする。枠の外を落とし、間引いてから整数にする */
export function pathData(rings: Pt[][], closed: boolean): string {
  const out: string[] = [];
  for (const ring of cropRings(rings, closed)) {
    const pts: string[] = [];
    let last = "";
    for (const p of simplify(ring, TOL)) {
      const s = `${Math.round(p.x)} ${Math.round(p.y)}`;
      if (s !== last) pts.push(s);
      last = s;
    }
    if (pts.length < 2) continue;
    out.push(`M${pts.join("L")}${closed ? "Z" : ""}`);
  }
  return out.join("");
}

function touchesView(rings: Pt[][]): boolean {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const p of r) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return maxX >= -MARGIN && minX <= W + MARGIN && maxY >= -MARGIN && minY <= H + MARGIN;
}

/** 2 点の距離（m） */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 世界座標 → 緯度経度 */
function toLatLng(p: Pt): { lat: number; lng: number } {
  const n = 2 ** ZOOM * EXTENT;
  const lng = (p.x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * p.y) / n))) * 180) / Math.PI;
  return { lat, lng };
}

export function buildNearby(features: MapFeature[], lat: number, lng: number, locale: Locale, spec: NearbySpec): Nearby {
  const center = toWorld(lat, lng);
  const { tx, inView } = viewOf(center, spec.span);
  const layers = spec.layers.map((k) => PATH_LAYERS[k]);
  const ds = new Map<string, string[]>();
  const places = new Map<PlaceKey, Map<string, NearbyPlace>>(spec.places.map((p) => [p.kind, new Map()]));
  for (const f of features) {
    if (f.type === 1) {
      const p = f.geometry[0]?.[0];
      if (!p) continue;
      for (const [kind, found] of places) {
        if (!PLACES[kind].sources.includes(f.layer)) continue;
        const name = PLACES[kind].name(f.props, locale);
        if (!name) continue;
        const v = tx(p);
        const s = { name, distanceM: distanceM({ lat, lng }, toLatLng(p)), x: Math.round(v.x), y: Math.round(v.y), inView: inView(v) };
        // 同じ場所が区画の境で 2 回出ることがあるので、名前で 1 つにする（近いほう）
        const prev = found.get(name);
        if (!prev || s.distanceM < prev.distanceM) found.set(name, s);
      }
      continue;
    }
    const keys = layers.flatMap((l) => (l.sources.includes(f.layer) ? l.pick(f) : []));
    if (!keys.length) continue;
    const rings = f.geometry.map((r) => r.map(tx));
    if (!touchesView(rings)) continue;
    const d = pathData(rings, f.type === 3);
    if (!d) continue;
    for (const k of keys) ds.set(k, [...(ds.get(k) ?? []), d]);
  }
  const p = tx(center);
  return {
    // 呼んだ順（layer の順）、layer の中は parts の順に下から重ねる
    paths: layers.flatMap((l) => l.parts.flatMap((part) => (ds.has(part.key) ? [{ ...part, d: ds.get(part.key)!.join("") }] : []))),
    point: { x: Math.round(p.x), y: Math.round(p.y) },
    places: spec.places.map(({ kind, limit }) => ({
      kind,
      items: [...places.get(kind)!.values()].sort((a, b) => a.distanceM - b.distanceM).slice(0, limit),
    })),
  };
}
