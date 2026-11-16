// 地方（8 区分）。画面で寄るためだけに使い、DB の親子・検索には入れない。都道府県コードで決まる固定の表
export type Chiho = { id: string; name: { ja: string; en: string }; prefectures: [from: number, to: number] };

export const CHIHO: Chiho[] = [
  { id: "hokkaido", name: { ja: "北海道", en: "Hokkaido" }, prefectures: [1, 1] },
  { id: "tohoku", name: { ja: "東北", en: "Tohoku" }, prefectures: [2, 7] },
  { id: "kanto", name: { ja: "関東", en: "Kanto" }, prefectures: [8, 14] },
  { id: "chubu", name: { ja: "中部", en: "Chubu" }, prefectures: [15, 23] },
  { id: "kinki", name: { ja: "近畿", en: "Kinki" }, prefectures: [24, 30] },
  { id: "chugoku", name: { ja: "中国", en: "Chugoku" }, prefectures: [31, 35] },
  { id: "shikoku", name: { ja: "四国", en: "Shikoku" }, prefectures: [36, 39] },
  { id: "kyushu", name: { ja: "九州・沖縄", en: "Kyushu & Okinawa" }, prefectures: [40, 47] },
];

/** 市区町村コード（5 桁）か都道府県コード（2 桁）の地方 */
export function chihoOf(code: string): Chiho | undefined {
  const pref = Number(code.slice(0, 2));
  return CHIHO.find((c) => pref >= c.prefectures[0] && pref <= c.prefectures[1]);
}
