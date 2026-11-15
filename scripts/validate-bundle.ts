// bundle を送る前に確かめる（API キーも API も使わない）。形・種類ごとの中身の決まり（quality.ts）・同じ ref の重なり・写真の読み込みを、
// dest ごとに全部調べて一覧にする。import:bundle と同じ決まりなので、ここで OK なら投入でも弾かれない（API の 409 などは除く）。
// 使い方: pnpm bundle:validate <bundle.json> [--json]
//   --json: 結果を JSON で出す（エージェントが読む用）
//   exit 0 = 全部 OK、1 = NG あり、2 = 使い方の誤り・JSON として読めない

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseBundle } from "../src/lib/ingest/bundle.ts";
import { limiter } from "../src/lib/limit.ts";
import { collectPhoto, type BundlePhoto } from "./import-bundle/collect.ts";
import { download } from "./import-bundle/download.ts";
import { formatReport, groupByDest } from "./validate-bundle/report.ts";

const USAGE = "使い方: pnpm bundle:validate <bundle.json> [--json]";
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));
  const unknown = args.filter((a) => a.startsWith("--") && a !== "--json");
  if (!file || unknown.length) {
    console.error(unknown.length ? `知らないオプション: ${unknown.join(" ")}\n${USAGE}` : USAGE);
    return 2;
  }

  const bundlePath = resolve(process.cwd(), file);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(await readFile(bundlePath, "utf8"));
  } catch (e) {
    console.error(`JSON として読めない: ${msg(e)}`);
    return 2;
  }
  const rawDests = Array.isArray(raw?.dests) ? (raw.dests as Record<string, unknown>[]) : [];
  const errors: string[] = [];

  // bundle 全体（bundle_version・collector など）。dest の中身は 1 件ずつ調べるので、ここでは dests を空にする
  const top = parseBundle({ ...raw, dests: [] });
  if (!top.ok) errors.push(...top.errors);
  if (!Array.isArray(raw?.dests)) errors.push("/dests は配列");

  // 1 件ずつ：形と中身の決まり（1 件の不備で他の結果が隠れないように）
  const okIndexes: number[] = [];
  rawDests.forEach((d, i) => {
    const r = parseBundle({ ...raw, dests: [d] });
    if (r.ok) okIndexes.push(i);
    else for (const e of r.errors) if (e.startsWith("/dests/0")) errors.push(e.replace(/^\/dests\/0/, `/dests/${i}`));
  });

  // 同じ ref の重なり（bundle 全体で見る）
  const firstRef = new Map<string, number>();
  rawDests.forEach((d, i) => {
    const ref = typeof d?.ref === "string" ? d.ref : "";
    if (!ref) return;
    const j = firstRef.get(ref);
    if (j === undefined) firstRef.set(ref, i);
    else errors.push(`/dests/${i}/ref ref ${ref} が /dests/${j} と重なっている。1 つの bundle に同じ ref は 1 回だけ`);
  });

  // 写真：形が通った dest の写真を実際に読む（file は bundle からの相対パス、url はダウンロード）
  const run = limiter(6);
  const deps = { readFile: async (p: string) => new Uint8Array(await readFile(p)), download };
  const bundleDir = dirname(bundlePath);
  await Promise.all(
    okIndexes.flatMap((i) =>
      ((rawDests[i].photos as BundlePhoto[] | undefined) ?? []).map((p, k) =>
        run(() => collectPhoto(p, bundleDir, deps)).catch((e) => {
          errors.push(`/dests/${i}/photos/${k} 写真を読めない（${p.file ?? p.url}: ${msg(e)}）`);
        }),
      ),
    ),
  );

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
