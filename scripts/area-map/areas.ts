// エリア地図の定義。エリア id は regions 表の id と同じにする（地図で選ぶと ?area=<id> になる）。
// 形は国土数値情報（行政区域 N03）の市区町村と、e-Stat の町丁・字（小地域）を合わせて作る。

export type LngLat = [number, number];
export type BBox = [west: number, south: number, east: number, north: number];

// 形の材料。n03 は市区町村コード（N03_007）、estat は市区町村コードと、使う小地域の選び方
export type Part =
  | { n03: string }
  | { estat: string; names: string[] }          // 町丁・字の名前（S_NAME）で選ぶ
  | { estat: string; codeRange: [number, number] }; // 小地域コード（S_AREA）の先頭 3 桁の範囲で選ぶ

export type MapDef = {
  id: string;
  name: { ja: string; en: string };
  bbox: BBox;
  interval: number; // 簡略化の間隔（m）
  land: "prefectures" | "clip"; // 背景の陸地。prefectures は都道府県の輪郭（全国用）、clip は表示範囲で切った陸地
  shapes?: string[]; // 押すと選べるエリア（形）
  points?: string[]; // 押すと選べるエリア（点）
  links?: { map: string; shape?: string; at?: LngLat }[]; // 押すと寄る先の地図。shape は形のエリア、at は点
  wholes?: string[]; // 地図の上に「〇〇全体」として出す親エリア
};

export const AREA_PARTS: Record<string, Part[]> = {
  hakone: [{ n03: "14382" }],
  yumoto: [{ estat: "14382", names: ["湯本", "湯本茶屋", "塔之澤", "須雲川", "畑宿"] }],
  gora: [{ estat: "14382", names: ["強羅", "宮城野", "木賀", "二ノ平", "小涌谷", "宮ノ下", "底倉", "大平台"] }],
  sengokuhara: [{ estat: "14382", names: ["仙石原"] }],
  ashinoko: [{ estat: "14382", names: ["元箱根", "箱根", "芦之湯"] }],
  ito: [{ n03: "22208" }],
  shimoda: [{ n03: "22219" }],
  nishiizu: [{ n03: "22306" }],
  // 伊豆市の中は旧町で分ける（小地域コードの先頭 3 桁：修善寺町 011-052、中伊豆町 079-110）
  shuzenji: [{ estat: "22222", codeRange: [11, 52] }],
  nakaizu: [{ estat: "22222", codeRange: [79, 110] }],
  // 伊豆のうち子エリアに入らないところ。押すと「伊豆全体」を選ぶ
  izu: [
    { n03: "22205" }, { n03: "22225" }, { n03: "22301" }, { n03: "22302" }, { n03: "22304" }, { n03: "22305" }, { n03: "22325" },
    { estat: "22222", codeRange: [53, 78] }, // 土肥町・天城湯ヶ島町
  ],
};

// 町丁・字に区画が無いエリアは点で出す（位置はだいたい）
export const AREA_POINTS: Record<string, LngLat> = {
  owakudani: [139.0205, 35.2425],
};

export const MAPS: MapDef[] = [
  {
    id: "japan",
    name: { ja: "日本", en: "Japan" },
    bbox: [127.5, 24.0, 146.0, 45.7],
    interval: 5000,
    land: "prefectures",
    links: [{ map: "hakone-izu", at: [139.0, 35.0] }],
  },
  {
    id: "hakone-izu",
    name: { ja: "箱根・伊豆", en: "Hakone & Izu" },
    bbox: [138.68, 34.58, 139.22, 35.33],
    interval: 500,
    land: "clip",
    shapes: ["ito", "shimoda", "nishiizu", "shuzenji", "nakaizu", "izu"],
    links: [{ map: "hakone", shape: "hakone" }],
    wholes: ["hakone", "izu"],
  },
  {
    id: "hakone",
    name: { ja: "箱根", en: "Hakone" },
    bbox: [138.96, 35.165, 139.135, 35.3],
    interval: 100,
    land: "clip",
    shapes: ["yumoto", "gora", "sengokuhara", "ashinoko"],
    points: ["owakudani"],
    wholes: ["hakone"],
  },
];

// 元データ。N03 は全国版を 1 つ、e-Stat は使う市区町村ごと
export const N03_URL = "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2024/N03-20240101_GML.zip";
export const N03_BASENAME = "N03-20240101";
export const estatUrl = (code: string) =>
  `https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=${code}&coordSys=1&format=shape&downloadType=5&datum=2011`;
