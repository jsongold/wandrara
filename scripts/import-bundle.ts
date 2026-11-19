// bundle を検証し、写真を署名 URL で上げ、dest を API で下書きとして登録する（API キーだけで動く）。
// 使い方: pnpm import:bundle <bundle.json> [--dry-run] [--parallel | --parallel=N] [--area-local=<dir>]
//   環境変数 WANDRARA_API_URL / WANDRARA_API_KEY（API を呼ぶときだけ）
//   --dry-run: 検証と写真の読み込みまで。API は呼ばない
//   --area-local=<dir>: 検証した area_content を <dir>/<region_id>.json（画面が読む形）に書く。API は呼ばない
//     読む画面（area-highlights.ts）は試作のブランチ proto/area-purchase（#113）にあり、この変更には含めない
//   area_content のある bundle は、まだ API に送れない（表は MS1 #114 で作る）。--dry-run か --area-local で使う
//   --parallel: 写真の読み込み・アップロードと dest の登録を同時に 6 つ（=N なら N）まで走らせる。無ければ 1 つずつ

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { areaContentCounts, toAreaLocal } from "../src/lib/ingest/area-content.ts";
import { parseBundle } from "../src/lib/ingest/bundle.ts";
import { coreByType } from "../src/lib/ingest/cores.ts";
import { limiter } from "../src/lib/limit.ts";
import { parseArgs } from "./import-bundle/args.ts";
import { collectPhoto, type BundlePhoto, type Collected } from "./import-bundle/collect.ts";
import { createClient } from "./import-bundle/client.ts";

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "user-agent": "wandrara-import" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const apiUrl = process.env.WANDRARA_API_URL;
  const apiKey = process.env.WANDRARA_API_KEY;
  const usage = () => {
    console.error(
      "使い方: pnpm import:bundle <bundle.json> [--dry-run] [--parallel | --parallel=N] [--area-local=<dir>]\n  API を呼ぶときは環境変数 WANDRARA_API_URL（例 https://wandrara.vercel.app）と WANDRARA_API_KEY（wdr_...）が要る",
    );
    return 2;
  };
  if (!args.ok || !args.value.file) {
    if (!args.ok) console.error(args.error);
    return usage();
  }
  const { file, dryRun, parallel, areaLocal } = args.value;
  // API を呼ぶのは --dry-run も --area-local も無いときだけ。環境変数はそのときだけ要る
  const callsApi = !dryRun && !areaLocal;
  // 同時に走るものはすべてこの run を通す（run の中で run を待たない。n=1 で止まるため）
  const run = limiter(parallel);

  const bundlePath = resolve(process.cwd(), file);
  const bundleDir = dirname(bundlePath);
  const parsed = parseBundle(JSON.parse(await readFile(bundlePath, "utf8")));
  if (!parsed.ok) {
    console.error("bundle が正しくない:");
    for (const e of parsed.errors) console.error(`  ${e}`);
    return 1;
  }
  const area = parsed.value.area_content;
  if (area && callsApi) {
    console.error("area_content はまだ DB に送れない（表は MS1 #114 で作る）。--dry-run で確かめるか、--area-local=<dir> でローカルの JSON に書く");
    return 1;
  }
  if (areaLocal && !area) {
    console.error("--area-local には area_content のある bundle が要る");
    return 1;
  }
  if (callsApi && (!apiUrl || !apiKey)) return usage();

  const deps = { readFile: async (p: string) => new Uint8Array(await readFile(p)), download };
  const failures: string[] = [];
  const ok: { dest: (typeof parsed.value.dests)[number]; photos: Collected[] }[] = [];
  const label = (d: { ref?: string | null; slug?: string | null }) => d.ref ?? d.slug ?? "(ref なし)";

  const collected = await Promise.all(
    parsed.value.dests.map(async (dest) => {
      try {
        const photos = await Promise.all((dest.photos ?? []).map((p) => run(() => collectPhoto(p as BundlePhoto, bundleDir, deps))));
        return { dest, photos };
      } catch (e) {
        return { dest, error: msg(e) };
      }
    }),
  );
  for (const c of collected) {
    if ("error" in c) failures.push(`${label(c.dest)}: 写真を集められない（${c.error}）`);
    else ok.push(c);
  }

  if (!callsApi) {
    const tag = dryRun ? "dry-run" : "area-local";
    const n = ok.reduce((s, x) => s + x.photos.length, 0);
    console.log(`${tag}: dest ${ok.length} 件 / 写真 ${n} 枚を確認した（API は呼んでいない）`);
    if (area) console.log(`${tag}: エリアの中身 ${area.region_id}：${areaContentCounts(area)} を確認した`);
    for (const f of failures) console.error(`error: ${f}`);
    if (failures.length) return 1;
    if (areaLocal && area) {
      const dir = resolve(process.cwd(), areaLocal);
      await mkdir(dir, { recursive: true });
      const out = resolve(dir, `${area.region_id}.json`);
      await writeFile(out, JSON.stringify(toAreaLocal(area), null, 2) + "\n");
      console.log(`wrote ${out}`);
    }
    return 0;
  }

  const client = createClient(apiUrl!, apiKey!);
  const all = new Map<string, Collected>();
  for (const x of ok) for (const c of x.photos) all.set(c.sha256, c);
  const failedPhotos = new Map<string, string>();
  const list = [...all.values()];
  const batches: Collected[][] = [];
  for (let i = 0; i < list.length; i += 50) batches.push(list.slice(i, i + 50));
  await Promise.all(
    batches.map(async (batch) => {
      let ups;
      try {
        ups = await run(() => client.uploadUrls(batch.map((c) => ({ sha256: c.sha256, content_type: c.content_type }))));
      } catch (e) {
        for (const c of batch) failedPhotos.set(c.sha256, msg(e));
        return;
      }
      await Promise.all(
        ups.map(async (u) => {
          if (!u.signed_url) return; // もうある写真
          const c = all.get(u.sha256)!;
          try {
            await run(() => client.put(u.signed_url!, c.bytes, c.content_type));
          } catch (e) {
            failedPhotos.set(u.sha256, msg(e));
          }
        }),
      );
    }),
  );

  // 登録の結果は終わった順に出す（並列のとき bundle の順とは限らない）
  await Promise.all(
    ok.map(async ({ dest, photos }) => {
      const bad = photos.find((c) => failedPhotos.has(c.sha256));
      if (bad) {
        failures.push(`${label(dest)}: 写真を上げられない（${failedPhotos.get(bad.sha256)}）`);
        return;
      }
      const { core_type, ...body } = dest;
      const path = coreByType(core_type)!.path;
      try {
        const r = await run(() => client.registerDest(path, { ...body, ...(dest.photos ? { photos: photos.map((c) => c.photo) } : {}) }));
        if (r.unchanged) console.log(`unchanged: ${label(dest)} → /d/${r.slug}（${r.status} のまま）`);
        else console.log(`draft: ${label(dest)} → /d/${r.slug}`);
      } catch (e) {
        failures.push(`${label(dest)}: ${msg(e)}`);
      }
    }),
  );
  for (const f of failures) console.error(`error: ${f}`);
  console.log("公開するには: pnpm dest:publish <ref>...");
  return failures.length ? 1 : 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(msg(e)); process.exitCode = 1; },
);
