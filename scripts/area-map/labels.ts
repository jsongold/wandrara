// 生成した地図に、ラベルを出す縮尺（ロケールごと）を書き込む。
// 親の層（引いているとき）と子の層（寄せたとき。全国の子と点をまとめて）で別々に求める
import { labelScales, labelSize, shortName, toMaxUnit, type ZoomLabel } from "../../src/lib/area-label-zoom.ts";
import type { AreaMapBase, AreaMapChildren, MapArea } from "../../src/lib/area-map.ts";

export const PARENT_FONT = 13;
export const CHILD_FONT = 11;

type NameOf = (id: string, locale: string) => string;

const bySize = (a: MapArea, b: MapArea) => b.size - a.size || (a.id < b.id ? -1 : 1);

function unitsOf(ordered: ZoomLabel[]): Map<string, number | null> {
  return new Map([...labelScales(ordered)].map(([id, s]) => [id, toMaxUnit(s)]));
}

/** base と children に labelK（ロケール → ラベルを出す最大の k）を足したものを返す */
export function withLabelZooms(base: AreaMapBase, children: AreaMapChildren[], nameOf: NameOf, locales: readonly string[]): { base: AreaMapBase; children: AreaMapChildren[] } {
  const text = (id: string, l: string) => shortName(nameOf(id, l));
  const parentK = new Map<string, Record<string, number | null>>();
  const childK = new Map<string, Record<string, number | null>>();
  const put = (m: Map<string, Record<string, number | null>>, units: Map<string, number | null>, l: string) => {
    for (const [id, u] of units) m.set(id, { ...m.get(id), [l]: u });
  };
  const kidShapes = children.flatMap((c) => c.shapes.filter((s) => s.id !== c.parent)).sort(bySize);
  const points = children.flatMap((c) => c.points).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const l of locales) {
    put(parentK, unitsOf([...base.parents].sort(bySize).map((p) => ({ id: p.id, at: p.label, box: p.box, size: labelSize(text(p.id, l), PARENT_FONT) }))), l);
    // 子の層：点を先に（数が少なく目印になる）、あとは大きい順
    const kids: ZoomLabel[] = [
      ...points.map((p) => ({ id: p.id, at: p.at, box: null, size: labelSize(text(p.id, l), CHILD_FONT) })),
      ...kidShapes.map((s) => ({ id: s.id, at: s.label, box: s.box, size: labelSize(text(s.id, l), CHILD_FONT) })),
    ];
    put(childK, unitsOf(kids), l);
  }
  return {
    base: { ...base, parents: base.parents.map((p) => ({ ...p, labelK: parentK.get(p.id) })) },
    children: children.map((c) => ({
      ...c,
      shapes: c.shapes.map((s) => (s.id === c.parent ? s : { ...s, labelK: childK.get(s.id) })),
      points: c.points.map((p) => ({ ...p, labelK: childK.get(p.id) })),
    })),
  };
}

/** DB の名前から、画面と同じ規則で表示名を選ぶ（そのロケールが無ければ ja → en） */
export const nameFrom = (names: Map<string, Record<string, string>>): NameOf => (id, l) => {
  const n = names.get(id) ?? {};
  return n[l] || n.ja || n.en || id;
};
