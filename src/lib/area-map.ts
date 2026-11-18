// エリア地図のデータの形。scripts/area-map で生成し、src/generated/area-map/ に置く
// 1 枚の地図（全国）。開いたときは土台（陸地と親エリア）だけを読み、寄せたら見えている親の子を後から読む
export type LocalizedName = { ja: string; en: string };

/** 地図の座標での範囲 [x, y, 幅, 高さ] */
export type Box = [number, number, number, number];

/** 押せるエリアの形。label はラベルを置く位置、size は地図の座標での面積（大きいものからラベルを出す） */
export type MapArea = { id: string; d: string; label: [number, number]; box: Box; size: number };
/** 押せるエリアの点（大涌谷など） */
export type MapPoint = { id: string; at: [number, number] };

export type AreaMapBase = {
  viewBox: string; // 地図全体（全国）
  start: string; // 開いたときに見せる範囲（viewBox の形）
  land: string; // 背景の陸地の path
  parents: MapArea[]; // 親エリア（子も含めた全体の形）
};

export type AreaMapChildren = {
  parent: string;
  shapes: MapArea[]; // 子エリア。親自身の材料の残りがあれば id = 親の形も入る
  points: MapPoint[];
};

/** 開いたときの何倍まで寄せたら、親の代わりに子を出すか */
export const CHILD_ZOOM = 1.8;

export const AREA_MAP_CREDIT = {
  ja: "出典：国土数値情報（行政区域）、政府統計の総合窓口(e-Stat)の境界データを加工して作成",
  en: "Source: MLIT National Land Numerical Information (administrative areas) and e-Stat boundary data, processed by Wandrara",
} satisfies LocalizedName;
