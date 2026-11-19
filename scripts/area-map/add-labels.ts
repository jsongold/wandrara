// 生成済みの地図（src/generated/area-map）に、ラベルを出す縮尺を書き直す。形は作り直さない（数秒で終わる）
// 名前を変えたときはこれを流す。pnpm area-map:labels
import fs from "node:fs";
import path from "node:path";
import { LOCALES } from "../../src/lib/i18n/locale.ts";
import type { AreaMapBase, AreaMapChildren } from "../../src/lib/area-map.ts";
import { loadDefinitions } from "./definitions.ts";
import { nameFrom, withLabelZooms } from "./labels.ts";

const OUT = path.join(process.cwd(), "src/generated/area-map");
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(f, "utf8")) as T;

const defs = await loadDefinitions();
const names = new Map(defs.map((d) => [d.id, d.name as Record<string, string>]));
const base = read<AreaMapBase>(path.join(OUT, "base.json"));
const files = fs.readdirSync(path.join(OUT, "children")).filter((f) => f.endsWith(".json")).sort();
const children = files.map((f) => read<AreaMapChildren>(path.join(OUT, "children", f)));
const out = withLabelZooms(base, children, nameFrom(names), LOCALES);
fs.writeFileSync(path.join(OUT, "base.json"), JSON.stringify(out.base) + "\n");
for (const c of out.children) fs.writeFileSync(path.join(OUT, "children", `${c.parent}.json`), JSON.stringify(c) + "\n");
console.log(`labels: 親 ${out.base.parents.length}・子のファイル ${out.children.length}`);
