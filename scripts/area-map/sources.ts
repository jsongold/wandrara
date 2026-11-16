// 元データの版と取得先。版を替えるときは region_parts を migration で直し、地図を作り直す（自動変換はしない）
// 落とした元データは .cache/area-map/<版>/ に置く（コミットしない）
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PartSource } from "../../src/lib/region/types.ts";

export const SOURCE_VERSIONS: Record<PartSource, string> = { n03: "N03-2024", estat: "estat-2020" };

const CACHE = path.resolve(".cache/area-map");
const N03_URL = "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2024/N03-20240101_GML.zip";
const N03_BASENAME = "N03-20240101";
const estatUrl = (city: string) =>
  `https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=${city}&coordSys=1&format=shape&downloadType=5&datum=2011`;

async function download(url: string, dir: string): Promise<void> {
  if (fs.existsSync(dir)) return;
  console.log(`download ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ダウンロードに失敗しました: ${res.status} ${url}`);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const zip = `${dir}.zip`;
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-oq", zip, "-d", dir]);
  fs.rmSync(zip);
}

// 以前の置き場（版なし）にあれば版の置き場へ移す
function adoptLegacy(legacy: string, dir: string) {
  if (!fs.existsSync(dir) && fs.existsSync(legacy)) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.renameSync(legacy, dir);
  }
}

export type SourceFiles = { n03: string; estat: Record<string, string> };

/** N03 全国と、指定の市区町村の e-Stat 小地域の shp のパス（無ければ落とす） */
export async function fetchSources(estatCities: string[]): Promise<SourceFiles> {
  const n03Dir = path.join(CACHE, SOURCE_VERSIONS.n03);
  adoptLegacy(path.join(CACHE, "n03"), n03Dir);
  await download(N03_URL, n03Dir);
  const estat: Record<string, string> = {};
  for (const city of estatCities) {
    const dir = path.join(CACHE, SOURCE_VERSIONS.estat, city);
    adoptLegacy(path.join(CACHE, `estat-${city}`), dir);
    await download(estatUrl(city), dir);
    estat[city] = path.join(dir, `r2ka${city}.shp`);
  }
  return { n03: path.join(n03Dir, `${N03_BASENAME}.shp`), estat };
}

/** e-Stat の KEY_CODE（例 222220110）から市区町村コード（例 22222） */
export const cityOfKeyCode = (key: string) => key.slice(0, 5);
