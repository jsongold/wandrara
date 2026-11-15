// 生成ファイル（pnpm area-map:build）。手で直さない
import type { AreaMapData } from "@/lib/area-map";

export const AREA_MAP_LOADERS: Record<string, () => Promise<AreaMapData>> = {
  "japan": () => import("./japan.json").then((m) => m.default as unknown as AreaMapData),
  "hakone-izu": () => import("./hakone-izu.json").then((m) => m.default as unknown as AreaMapData),
  "hakone": () => import("./hakone.json").then((m) => m.default as unknown as AreaMapData),
};
