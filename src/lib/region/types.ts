// エリアの契約：DB の定義・位置の索引・位置から決めた結果。地図の生成（scripts/area-map）と取り込み（src/lib/ingest）が共有する
import type { GEO_PRECISIONS } from "../../db/schema/_shared.ts";

export type LngLat = [number, number];
export type BBox = [west: number, south: number, east: number, north: number];
export type LocalizedName = Record<string, string>;

/** 1 つの輪は [lng, lat] の列。Polygon = [外周, 穴...]、MultiPolygon = Polygon[] */
export type Ring = LngLat[];
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];

export type PartSource = "n03" | "estat";
export type RegionPart = { source: PartSource; version: string; code: string };

/** DB（regions ＋ region_parts）から読んだエリアの定義 */
export type RegionDef = {
  id: string;
  parentId: string | null;
  name: LocalizedName;
  sort: number | null;
  point: LngLat | null; // 区画の無いエリアの位置
  parts: RegionPart[];
};

/** 位置の索引（都道府県ごと）。判定用の形は元データを 10m 間隔だけ簡略化したもの（表示用の簡略化・小島の削除・隙間埋めはしない。元の形と最大 10m ほどずれる） */
export type LookupShard = {
  prefecture: string; // 都道府県コード 2 桁
  municipalities: { code: string; name: string; shape: MultiPolygon }[]; // 定義が使う市区町村の形（N03）
  areas: { id: string; municipalities: string[]; shape: MultiPolygon }[]; // エリア自身の材料：市区町村まるごと＋町丁字の形
  codeAreas: Record<string, string[]>; // 市区町村コード → その市区町村に材料を持つエリア
};

/** 索引の目次。どの県の索引を開くかと、エリアの親子 */
export type LookupManifest = {
  version: string; // 定義と元データの版から作る。変わると取り込みの content_hash も変わる
  sources: Record<PartSource, string>;
  prefectures: { code: string; name: string; bbox: BBox }[];
  parents: Record<string, string | null>;
  points: string[]; // 区画の無い（点だけの）エリア
};

/** 代表の位置。宿などはコアの位置、体験は details.locations の代表（meeting 優先、無ければ先頭） */
export type GeoPrecision = (typeof GEO_PRECISIONS)[number];
export type RepresentativeLocation = {
  lat: number | null;
  lng: number | null;
  precision: GeoPrecision | null;
  prefecture: string | null; // 都道府県名（例 静岡県）
  municipality: string | null; // 市区町村名（例 伊豆市）
};

export type UnresolvedReason = "outside" | "no_location" | "ambiguous";
export type ResolveResult =
  | { ok: true; regionId: string; by: "point" | "municipality" }
  | { ok: false; reason: UnresolvedReason };

/** 明示された region_id も合わせて決めた、書き込む region_id */
export type RegionDecision =
  | { ok: true; regionId: string; by: "explicit" | "point" | "municipality" }
  | { ok: false; reason: UnresolvedReason | "unknown_region" };
