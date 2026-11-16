// region_parts の初期行の元（一度だけ使う）。以前コードに手書きしていたエリアの作り方をそのまま写したもの。
// 正本は DB（regions・region_parts）。ここを直しても地図は変わらない

import type { LngLat } from "../../src/lib/region/types.ts";

// 形の材料。n03 は市区町村コード（N03_007）、estat は市区町村コードと、使う小地域の選び方
export type Part =
  | { n03: string }
  | { estat: string; names: string[] }          // 町丁・字の名前（S_NAME）で選ぶ
  | { estat: string; codeRange: [number, number] }; // 小地域コード（S_AREA）の先頭 3 桁の範囲で選ぶ


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
