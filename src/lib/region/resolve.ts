// 代表の位置からエリアを決める（純関数）。索引は呼ぶ側が開いて渡す（lookup.ts）
// 決め方：
// - exact・street・district：座標が入るエリアのうち、いちばん深いもの。兄弟の境界・重なりは共通の親、親が無ければ ambiguous
// - municipality・精度なし：座標を子に当てない。座標が入る市区町村（座標が無ければ都道府県＋市区町村名）に材料を持つエリアの共通の親
// - 点だけのエリア（大涌谷）は索引に形が無いので、自動では選ばれない
import type {
  LngLat,
  LookupManifest,
  LookupShard,
  MultiPolygon,
  RegionDecision,
  RepresentativeLocation,
  ResolveResult,
  Ring,
} from "./types.ts";

const EPS = 1e-9;

// 線分の上なら内側とみなす
function onSegment([x, y]: LngLat, [x1, y1]: LngLat, [x2, y2]: LngLat): boolean {
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(cross) > EPS) return false;
  return x >= Math.min(x1, x2) - EPS && x <= Math.max(x1, x2) + EPS && y >= Math.min(y1, y2) - EPS && y <= Math.max(y1, y2) + EPS;
}

/** 輪の中か。-1 = 外、0 = 線の上、1 = 中 */
function ringSide(p: LngLat, ring: Ring): -1 | 0 | 1 {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (onSegment(p, a, b)) return 0;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? 1 : -1;
}

/** 形の中か（線の上も中。穴の中は外、穴の線の上は中） */
export function inShape(p: LngLat, shape: MultiPolygon): boolean {
  for (const [outer, ...holes] of shape) {
    if (!outer || ringSide(p, outer) < 0) continue;
    if (holes.every((h) => ringSide(p, h) <= 0)) return true;
  }
  return false;
}

/** 自分を含む祖先の列（自分 → 親 → ...） */
export function lineage(id: string, parents: Record<string, string | null>): string[] {
  const out: string[] = [];
  for (let cur: string | null | undefined = id; cur && !out.includes(cur); cur = parents[cur]) out.push(cur);
  return out;
}

/** 共通の祖先（自分も含む）。無ければ null */
export function commonAncestor(ids: string[], parents: Record<string, string | null>): string | null {
  if (ids.length === 0) return null;
  const [first, ...rest] = ids.map((id) => lineage(id, parents));
  return first.find((a) => rest.every((l) => l.includes(a))) ?? null;
}

/** 祖先に当たるものを外し、残りが 1 つならそれ、複数なら共通の祖先 */
function deepest(ids: string[], parents: Record<string, string | null>): string | null {
  const uniq = [...new Set(ids)];
  const leaves = uniq.filter((id) => !uniq.some((o) => o !== id && lineage(o, parents).includes(id)));
  return leaves.length === 1 ? leaves[0] : commonAncestor(leaves, parents);
}

const hasPoint = (loc: RepresentativeLocation) => Number.isFinite(loc.lat) && Number.isFinite(loc.lng) && loc.lat !== null && loc.lng !== null;
const isPrecise = (loc: RepresentativeLocation) => loc.precision === "exact" || loc.precision === "street" || loc.precision === "district";

/** 開く県の索引（座標が入る県の範囲。座標が無ければ都道府県名） */
export function candidatePrefectures(loc: RepresentativeLocation, manifest: LookupManifest): string[] {
  if (hasPoint(loc)) {
    const [x, y] = [loc.lng as number, loc.lat as number];
    return manifest.prefectures.filter(({ bbox: [w, s, e, n] }) => x >= w && x <= e && y >= s && y <= n).map((p) => p.code);
  }
  const pref = loc.prefecture?.trim();
  if (pref) return manifest.prefectures.filter((p) => p.name === pref).map((p) => p.code);
  return [];
}

export function resolveRegion(loc: RepresentativeLocation, shards: LookupShard[], manifest: LookupManifest): ResolveResult {
  const parents = manifest.parents;
  const point = hasPoint(loc) ? ([loc.lng, loc.lat] as LngLat) : null;
  if (!point && !(loc.prefecture && loc.municipality)) return { ok: false, reason: "no_location" };

  if (point && isPrecise(loc)) {
    const hits: string[] = [];
    for (const s of shards) {
      const munis = new Set(s.municipalities.filter((m) => inShape(point, m.shape)).map((m) => m.code));
      for (const a of s.areas) if (a.municipalities.some((c) => munis.has(c)) || inShape(point, a.shape)) hits.push(a.id);
    }
    if (hits.length === 0) return { ok: false, reason: "outside" };
    const id = deepest(hits, parents);
    return id ? { ok: true, regionId: id, by: "point" } : { ok: false, reason: "ambiguous" };
  }

  // 粗い位置：市区町村まで
  const candidates: string[] = [];
  let matched = false;
  for (const s of shards) {
    const munis = point
      ? s.municipalities.filter((m) => inShape(point, m.shape))
      : s.municipalities.filter((m) => m.name === (loc.municipality ?? "").trim());
    for (const m of munis) {
      matched = true;
      candidates.push(...(s.codeAreas[m.code] ?? []));
    }
  }
  if (!matched || candidates.length === 0) return { ok: false, reason: "outside" };
  const id = commonAncestor([...new Set(candidates)], parents);
  return id ? { ok: true, regionId: id, by: "municipality" } : { ok: false, reason: "ambiguous" };
}

/**
 * 書き込む region_id を 1 つの規則で決める（取り込みと付け直しで同じ）
 * ① 明示が実在し、決めた結果と同じかその子孫なら明示。点だけのエリア（大涌谷）は、その親が決めた結果と同じかその祖先なら明示
 *   （大涌谷は形を持たないので、座標では隣の仙石原などに決まる。明示した大涌谷を残す）
 * ② それ以外で決まれば決めた結果 ③ 決まらなければ実在する明示 ④ どれも無ければ決まらない
 * 明示が DB に無い id なら、位置で決まっても unknown_region（書き間違いを黙って捨てない）
 */
export function decideRegion(
  resolved: ResolveResult,
  explicit: string | null | undefined,
  exists: (id: string) => boolean,
  manifest: Pick<LookupManifest, "parents" | "points">,
): RegionDecision {
  const { parents, points } = manifest;
  if (explicit && !exists(explicit)) return { ok: false, reason: "unknown_region" };
  const ex = explicit || null;
  if (resolved.ok) {
    const under = (id: string | null) => !!id && lineage(id, parents).includes(resolved.regionId);
    const pointNear = (id: string) => points.includes(id) && !!parents[id] && lineage(resolved.regionId, parents).includes(parents[id] as string);
    if (ex && (under(ex) || pointNear(ex))) return { ok: true, regionId: ex, by: "explicit" };
    return { ok: true, regionId: resolved.regionId, by: resolved.by };
  }
  if (ex) return { ok: true, regionId: ex, by: "explicit" };
  if (explicit) return { ok: false, reason: "unknown_region" };
  return { ok: false, reason: resolved.reason };
}
