// 点のまわりの OpenFreeMap の区画（ズーム 14・2×2）を取り、spec のとおりの地図と近くの場所にする。
// OpenFreeMap は商用可・キー不要。出典（OpenMapTiles・OpenStreetMap）を地図の下に出す。
// 区画の URL は版ごとに変わるので TileJSON から読む。
import { VectorTile } from "@mapbox/vector-tile";
import { cacheLife } from "next/cache";
import { PbfReader } from "pbf";
import type { Locale } from "../types";
import { buildNearby, EXTENT, sourcesOf, tilesAround, ZOOM, type MapFeature, type Nearby } from "./build";
import type { NearbySpec } from "./spec";

const TILEJSON = "https://tiles.openfreemap.org/planet";

async function getNearbyCached(lat: number, lng: number, locale: Locale, spec: NearbySpec): Promise<Nearby> {
  "use cache";
  cacheLife("weeks");
  if (!spec.layers.length && !spec.places.length) return buildNearby([], lat, lng, locale, spec);
  const tj = (await (await fetch(TILEJSON)).json()) as { tiles?: string[] };
  const template = tj.tiles?.[0];
  if (!template) throw new Error("OpenFreeMap の TileJSON に tiles がありません");
  const tiles = await Promise.all(
    tilesAround(lat, lng).map(async (t) => {
      const res = await fetch(template.replace("{z}", String(ZOOM)).replace("{x}", String(t.x)).replace("{y}", String(t.y)));
      if (!res.ok) throw new Error(`OpenFreeMap の区画を読めません: ${res.status}`);
      return { ...t, tile: new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer()))) };
    }),
  );
  // 区画は丸ごと届くので、spec で使う層だけほどく
  const sources = sourcesOf(spec);
  const features: MapFeature[] = [];
  for (const { x, y, tile } of tiles) {
    for (const name of sources) {
      const layer = tile.layers[name];
      if (!layer) continue;
      const k = EXTENT / layer.extent;
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        const geometry = f.loadGeometry().map((ring) => ring.map((p) => ({ x: x * EXTENT + p.x * k, y: y * EXTENT + p.y * k })));
        features.push({ layer: name, type: f.type, props: f.properties, geometry });
      }
    }
  }
  return buildNearby(features, lat, lng, locale, spec);
}

/** 読めなかったときは null（地図を出さないだけで、ページは壊さない）。失敗はキャッシュしない */
export async function getNearby(lat: number, lng: number, locale: Locale, spec: NearbySpec): Promise<Nearby | null> {
  try {
    return await getNearbyCached(lat, lng, locale, spec);
  } catch (e) {
    console.error("周辺の地図を作れませんでした", e);
    return null;
  }
}
