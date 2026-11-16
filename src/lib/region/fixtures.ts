// テスト用の小さい索引。座標は箱根・伊豆の外（経度 0〜12・緯度 0〜6 の架空の土地）
//
//  緯度
//   5 |      [i1 の離島]
//   2 | M1(H)      | M2(i1)  穴=M5(B)  | M3(I の残り) [C が重なる] | M4: 左=i2 右=I
//   0 +--h1--|--h2-+----------------------+----------------------------+-----------
//     0      1     2                      4                            6     7     8  経度
// H（箱根に当たる）：市区町村 M1 まるごと。子 h1・h2 は M1 の中の町丁字、hp は点だけ
// I（伊豆に当たる）：自分の材料は M3 まるごとと M4 の右半分。子 i1 は M2 まるごと（離島つき・穴あり）、i2 は M4 の左半分
// B：M2 の穴（飛び地 M5）。C：M3 に重なる別の親（重なり → 決まらない）
import type { LookupManifest, LookupShard, MultiPolygon, Polygon } from "./types.ts";

export const sq = (x: number, y: number, w: number, h = w): Polygon => [
  [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]],
];
const withHole = (outer: Polygon, hole: Polygon): Polygon => [outer[0], hole[0]];

const M2: MultiPolygon = [withHole(sq(2, 0, 2, 2), sq(3, 0.5, 0.5, 0.5)), sq(2, 5, 0.5, 0.5)];

export const FIXTURE_SHARD: LookupShard = {
  prefecture: "99",
  municipalities: [
    { code: "99001", name: "一町", shape: [sq(0, 0, 2, 2)] },
    { code: "99002", name: "二市", shape: M2 },
    { code: "99003", name: "三町", shape: [sq(4, 0, 2, 2)] },
    { code: "99004", name: "四市", shape: [sq(6, 0, 2, 2)] },
    { code: "99005", name: "五村", shape: [sq(3, 0.5, 0.5, 0.5)] },
  ],
  areas: [
    { id: "h", municipalities: ["99001"], shape: [] },
    { id: "h1", municipalities: [], shape: [sq(0, 0, 1, 1)] },
    { id: "h2", municipalities: [], shape: [sq(1, 0, 1, 1)] },
    { id: "i", municipalities: ["99003"], shape: [sq(7, 0, 1, 2)] },
    { id: "i1", municipalities: ["99002"], shape: [] },
    { id: "i2", municipalities: [], shape: [sq(6, 0, 1, 2)] },
    { id: "b", municipalities: ["99005"], shape: [] },
    { id: "c", municipalities: [], shape: [sq(5, 1, 0.5, 0.5)] },
  ],
  codeAreas: {
    "99001": ["h", "h1", "h2"],
    "99002": ["i1"],
    "99003": ["i", "c"],
    "99004": ["i2", "i"],
    "99005": ["b"],
  },
};

export const FIXTURE_MANIFEST: LookupManifest = {
  version: "fixture-1",
  sources: { n03: "N03-test", estat: "estat-test" },
  prefectures: [{ code: "99", name: "架空県", bbox: [0, 0, 8, 5.5] }],
  parents: { h: null, h1: "h", h2: "h", hp: "h", i: null, i1: "i", i2: "i", b: null, c: null },
  points: ["hp"],
};
