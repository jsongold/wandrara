// bundle を検証し、写真を署名 URL で上げ、dest を API で下書きとして登録する（API キーだけで動く）。
// 使い方: pnpm import:bundle <bundle.json> [--dry-run]
//   環境変数 WANDRARA_API_URL / WANDRARA_API_KEY
//   --dry-run: 検証と写真の読み込みまで。API は呼ばない

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseBundle } from "../src/lib/ingest/bundle.ts";
import { coreByType } from "../src/lib/ingest/cores.ts";
import { collectPhoto, type BundlePhoto, type Collected } from "./import-bundle/collect.ts";
import { createClient } from "./import-bundle/client.ts";

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "user-agent": "wandrara-import" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  const apiUrl = process.env.WANDRARA_API_URL;
  const apiKey = process.env.WANDRARA_API_KEY;
  if (!file || !apiUrl || !apiKey) {
    console.error("使い方: pnpm import:bundle <bundle.json> [--dry-run]\n  環境変数 WANDRARA_API_URL（例 https://wandrara.vercel.app）と WANDRARA_API_KEY（wdr_...）が要る");
    return 2;
  }

  const bundlePath = resolve(process.cwd(), file);
  const bundleDir = dirname(bundlePath);
  const parsed = parseBundle(JSON.parse(await readFile(bundlePath, "utf8")));
  if (!parsed.ok) {
    console.error("bundle が正しくない:");
    for (const e of parsed.errors) console.error(`  ${e}`);
    return 1;
  }

  const deps = { readFile: async (p: string) => new Uint8Array(await readFile(p)), download };
  const failures: string[] = [];
  const ok: { dest: (typeof parsed.value.dests)[number]; photos: Collected[] }[] = [];
  const label = (d: { ref?: string | null; slug?: string | null }) => d.ref ?? d.slug ?? "(ref なし)";

  for (const dest of parsed.value.dests) {
    const photos: Collected[] = [];
    try {
      for (const p of dest.photos ?? []) photos.push(await collectPhoto(p as BundlePhoto, bundleDir, deps));
      ok.push({ dest, photos });
    } catch (e) {
      failures.push(`${label(dest)}: 写真を集められない（${msg(e)}）`);
    }
  }

  if (dryRun) {
    const n = ok.reduce((s, x) => s + x.photos.length, 0);
    console.log(`dry-run: dest ${ok.length} 件 / 写真 ${n} 枚を確認した（API は呼んでいない）`);
    for (const f of failures) console.error(`error: ${f}`);
    return failures.length ? 1 : 0;
  }

  const client = createClient(apiUrl, apiKey);
  const all = new Map<string, Collected>();
  for (const x of ok) for (const c of x.photos) all.set(c.sha256, c);
  const failedPhotos = new Map<string, string>();
  const list = [...all.values()];
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    try {
      const ups = await client.uploadUrls(batch.map((c) => ({ sha256: c.sha256, content_type: c.content_type })));
      for (const u of ups) {
        const c = all.get(u.sha256)!;
        try {
          if (u.signed_url) await client.put(u.signed_url, c.bytes, c.content_type);
        } catch (e) {
          failedPhotos.set(u.sha256, msg(e));
        }
      }
    } catch (e) {
      for (const c of batch) failedPhotos.set(c.sha256, msg(e));
    }
  }

  for (const { dest, photos } of ok) {
    const bad = photos.find((c) => failedPhotos.has(c.sha256));
    if (bad) {
      failures.push(`${label(dest)}: 写真を上げられない（${failedPhotos.get(bad.sha256)}）`);
      continue;
    }
    const { core_type, ...body } = dest;
    const path = coreByType(core_type)!.path;
    try {
      const r = await client.registerDest(path, { ...body, ...(dest.photos ? { photos: photos.map((c) => c.photo) } : {}) });
      console.log(`draft: ${label(dest)} → /d/${r.slug}`);
    } catch (e) {
      failures.push(`${label(dest)}: ${msg(e)}`);
    }
  }
  for (const f of failures) console.error(`error: ${f}`);
  console.log("公開するには（管理者の作業）: pnpm dest:status <ref> published");
  return failures.length ? 1 : 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(msg(e)); process.exitCode = 1; },
);
