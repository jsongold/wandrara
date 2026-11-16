// 生成ファイル（pnpm area-map:build）。手で直さない
import type { LookupManifest, LookupShard } from "../../lib/region/types.ts";

export { LOOKUP_MANIFEST } from "./manifest.ts";

/** 都道府県コード → 索引（必要な県だけ読む） */
export const LOOKUP_LOADERS: Record<string, () => Promise<LookupShard>> = {
  "14": () => import("./14.ts").then((m) => m.default),
  "22": () => import("./22.ts").then((m) => m.default),
};
