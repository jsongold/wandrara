// 6 つのコアの定義を並べる（取り込み・詳細の画面が使う）
import { accommodationCore } from "../../db/schema/accommodation.ts";
import { buildingCore } from "../../db/schema/building.ts";
import { experienceCore } from "../../db/schema/experience.ts";
import { hotspringCore } from "../../db/schema/hotspring.ts";
import { natureCore } from "../../db/schema/nature.ts";
import { villageCore } from "../../db/schema/village.ts";
import type { CoreDef } from "../../db/schema/_shared.ts";

export const CORES: CoreDef[] = [accommodationCore, experienceCore, natureCore, villageCore, buildingCore, hotspringCore];

export function coreByType(t: string): CoreDef | undefined {
  return CORES.find((c) => c.coreType === t);
}

export function coreByPath(p: string): CoreDef | undefined {
  return CORES.find((c) => c.path === p);
}
