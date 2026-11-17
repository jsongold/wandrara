// 地図に載せるものの定義。1 つ = 1 メソッド（spec.ts の nearbyMap().green() など）。
// OpenFreeMap の見た目の定義（Liberty）の層を、層の id でどのメソッドのものか決める。
// どのメソッドにも入らない層（境界線・空港・3D の建物・広域の陰影など）は出さない。背景だけはいつも出す。

export const GROUPS = {
  /** 森・草地・公園・土地利用 */
  green: (id: string) => /^(park|landcover_|landuse_)/.test(id),
  /** 海・湖・川と、その名前 */
  water: (id: string) => /^(water$|waterway_(tunnel|river|other|line_label)$|water_name_)/.test(id),
  /** 道と道の名前・番号（線路は rail） */
  roads: (id: string) => (/^(tunnel|road|bridge)_/.test(id) && !/_rail/.test(id)) || /^(highway-|road_shield)/.test(id),
  /** 線路 */
  rail: (id: string) => /^(tunnel|road|bridge)_.*_rail/.test(id),
  /** 建物 */
  buildings: (id: string) => id === "building",
  /** 町・地区の名前 */
  placeNames: (id: string) => id.startsWith("label_"),
  /** 駅 */
  stations: (id: string) => id === "poi_transit",
  /** お店・名所などの場所 */
  pois: (id: string) => /^poi_r\d+$/.test(id),
} satisfies Record<string, (id: string) => boolean>;

export type GroupKey = keyof typeof GROUPS;
