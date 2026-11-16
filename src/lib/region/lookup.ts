// 位置の索引を読み、代表の位置からエリアを決める。索引は必要な県だけ読む（サーバーと CLI だけで使う。画面からは import しない）
import { LOOKUP_LOADERS, LOOKUP_MANIFEST } from "../../generated/region-lookup/index.ts";
import { candidatePrefectures, resolveRegion } from "./resolve.ts";
import type { LookupShard, RepresentativeLocation, ResolveResult } from "./types.ts";

const cache = new Map<string, Promise<LookupShard>>();

function shard(pref: string): Promise<LookupShard> | null {
  const load = LOOKUP_LOADERS[pref];
  if (!load) return null;
  let p = cache.get(pref);
  if (!p) {
    p = load();
    cache.set(pref, p);
  }
  return p;
}

export const lookupVersion = LOOKUP_MANIFEST.version;

export async function resolveLocation(loc: RepresentativeLocation): Promise<ResolveResult> {
  const shards = await Promise.all(candidatePrefectures(loc, LOOKUP_MANIFEST).flatMap((c) => shard(c) ?? []));
  return resolveRegion(loc, shards, LOOKUP_MANIFEST);
}

export const lookupManifest = LOOKUP_MANIFEST;
