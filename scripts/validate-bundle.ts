// bundle を送る前に確かめる（API キーも API も使わない）。形・種類ごとの中身の決まり（quality.ts）・同じ ref の重なり・写真の読み込みを、
// dest ごとに全部調べて一覧にする。import:bundle と同じ決まりなので、ここで OK なら投入でも弾かれない（API の 409 などは除く）。
// 使い方: pnpm bundle:validate <bundle.json> [--json]
//   --json: 結果を JSON で出す（エージェントが読む用）
//   exit 0 = 全部 OK、1 = NG あり、2 = 使い方の誤り・JSON として読めない

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { limiter } from "../src/lib/limit.ts";
import { collectPhoto } from "./import-bundle/collect.ts";
import { download } from "./import-bundle/download.ts";
import { formatReport, groupByDest } from "./validate-bundle/report.ts";
import { validateBundle } from "./validate-bundle/validate.ts";

const USAGE = "使い方: pnpm bundle:validate <bundle.json> [--json]";
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const files = args.filter((a) => !a.startsWith("--"));
  const unknown = args.filter((a) => a.startsWith("--") && a !== "--json");
  if (files.length !== 1 || unknown.length) {
    if (unknown.length) console.error(`知らないオプション: ${unknown.join(" ")}`);
    else if (files.length > 1) console.error(`bundle は 1 つだけ指定する（${files.length} 個あった）`);
    console.error(USAGE);
    return 2;
  }

  const bundlePath = resolve(process.cwd(), files[0]);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(bundlePath, "utf8"));
  } catch (e) {
    console.error(`JSON として読めない: ${msg(e)}`);
    return 2;
  }

  // 写真：file は bundle からの相対パス、url はダウンロード（10MB を超えたら途中でやめる）。6 つずつ
  const deps = { readFile: async (p: string) => new Uint8Array(await readFile(p)), download };
  const bundleDir = dirname(bundlePath);
  const errors = await validateBundle(raw, (p) => collectPhoto(p, bundleDir, deps), limiter(6));

  const rawDests = raw && typeof raw === "object" && Array.isArray((raw as { dests?: unknown }).dests) ? ((raw as { dests: unknown[] }).dests) : [];
  const report = groupByDest(errors, rawDests);
  for (const d of report.dests) d.errors.sort();
  if (json) console.log(JSON.stringify({ ok: !report.bundle.length && report.dests.every((d) => !d.errors.length), ...report }, null, 2));
  else console.log(formatReport(report));
  return report.bundle.length || report.dests.some((d) => d.errors.length) ? 1 : 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(msg(e)); process.exitCode = 1; },
);
