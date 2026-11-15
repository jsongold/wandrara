// 緯度経度を表示範囲に合わせて SVG の座標にする（メルカトル。範囲の幅を width px に合わせる）
import type { BBox, LngLat } from "./areas.ts";

export type Geometry = { type: string; coordinates: unknown };
export type Projection = { viewBox: string; project: (p: LngLat) => [number, number]; inside: (p: LngLat) => boolean };

const merc = ([lng, lat]: LngLat): [number, number] => [(lng * Math.PI) / 180, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
const round1 = (v: number) => Math.round(v * 10) / 10;

export function makeProjection(bbox: BBox, width: number): Projection {
  const [x0, y1] = merc([bbox[0], bbox[1]]);
  const [x1, y0] = merc([bbox[2], bbox[3]]);
  const k = width / (x1 - x0);
  const height = Math.round((y0 - y1) * k);
  return {
    viewBox: `0 0 ${width} ${height}`,
    project: (p) => {
      const [x, y] = merc(p);
      return [round1((x - x0) * k), round1((y0 - y) * k)];
    },
    inside: ([lng, lat]) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3],
  };
}

// 外周・穴を 1 つの path に。範囲に 1 点も入らない輪と、丸めて潰れた輪は捨てる
function ringPath(ring: LngLat[], pr: Projection): string {
  if (!ring.some(pr.inside)) return "";
  const pts: [number, number][] = [];
  for (const c of ring) {
    const p = pr.project(c);
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (pts.length < 3) return "";
  return "M" + pts.map((p) => p.join(",")).join("L") + "Z";
}

export function pathOf(g: Geometry | null, pr: Projection): string {
  if (!g) return "";
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []) as LngLat[][][];
  return polys.map((poly) => poly.map((ring) => ringPath(ring, pr)).join("")).join("");
}
