// エリア地図のデータの形。scripts/area-map で生成し、src/generated/area-map/ に置く
export type LocalizedName = { ja: string; en: string };

export type AreaMapData = {
  id: string;
  name: LocalizedName;
  viewBox: string; // 地図全体
  start?: string; // 開いたときに見せる範囲（viewBox の形。無ければ全体）
  land: string; // 背景の陸地の path
  shapes: { id: string; d: string; label: [number, number] }[]; // 押すと選べるエリア（形）
  points: { id: string; at: [number, number] }[]; // 押すと選べるエリア（点）
  links: { map: string; name: LocalizedName; d?: string; at: [number, number] }[]; // 押すと寄る先の地図
  wholes: string[]; // 「〇〇全体」として出す親エリア
};

export const AREA_MAP_START = "japan";
export const AREA_MAP_CREDIT = {
  ja: "出典：国土数値情報（行政区域）、政府統計の総合窓口(e-Stat)の境界データを加工して作成",
  en: "Source: MLIT National Land Numerical Information (administrative areas) and e-Stat boundary data, processed by Wandrara",
} satisfies LocalizedName;
