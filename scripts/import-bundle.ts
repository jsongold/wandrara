// コレクターの content bundle を検証し、写真をバケットに置いて、Supabase に投入する。
// 使い方: pnpm import:bundle <bundle.json> [--dry-run]
//   --dry-run: 写真は置かず、SQL を DB で実行してからロールバックする
// 前提: supabase CLI にログイン済みで、このリポジトリが対象プロジェクトに link 済み。

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { planImport, type Bundle, type Refs } from "./import-bundle/plan.ts";
import { BUCKET, uploadPhotos } from "./import-bundle/photo.ts";
import { renderSql } from "./import-bundle/sql.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "wandrara-import-"));

function supabase(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync("supabase", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function query(sql: string): unknown[] {
  const r = supabase(["db", "query", "--linked", "-o", "json", sql]);
  if (!r.ok) throw new Error(`DB の読み込みに失敗した:\n${r.stderr}`);
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).rows;
}

function fetchRefs(): Refs {
  const [row] = query(`select json_build_object(
    'areas', (select coalesce(json_agg(id), '[]') from public.areas),
    'categories', (select coalesce(json_agg(id), '[]') from public.categories),
    'spots', (select coalesce(json_agg(json_build_object('id', id, 'ref', external_ref)), '[]') from public.spots)) as refs`) as { refs: { areas: string[]; categories: string[]; spots: { id: string; ref: string | null }[] } }[];
  return {
    areas: new Set(row.refs.areas),
    categories: new Set(row.refs.categories),
    spots: new Map(row.refs.spots.map((s) => [s.id, s.ref])),
  };
}

function projectUrl(): string {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `https://${readFileSync(join(ROOT, "supabase/.temp/project-ref"), "utf8").trim()}.supabase.co`;
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "user-agent": "wandrara-import" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

let uploadSeq = 0;
async function upload(bytes: Uint8Array, objectPath: string, contentType: string): Promise<void> {
  const local = join(work, `photo-${uploadSeq++}`);
  writeFileSync(local, bytes);
  const r = supabase(["storage", "cp", "--linked", "--experimental", "--content-type", contentType, local, `ss:///${BUCKET}/${objectPath}`]);
  // パスは中身のハッシュなので、すでにあれば同じ画像
  if (!r.ok && !r.stderr.includes("KeyAlreadyExists")) throw new Error(r.stderr.trim().split("\n").pop() ?? "upload failed");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("使い方: pnpm import:bundle <bundle.json> [--dry-run]");
    process.exit(2);
  }
  const bundlePath = resolve(process.cwd(), file);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as Bundle;

  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  // 日本語を含む URL も受け付ける（ajv-formats には iri が無い）
  ajv.addFormat("iri", (s: string) => {
    try {
      return ["http:", "https:"].includes(new URL(s).protocol);
    } catch {
      return false;
    }
  });
  const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, "schema/content-bundle.schema.json"), "utf8")));
  if (!validate(bundle)) {
    console.error("スキーマに合わない:");
    for (const e of validate.errors ?? []) console.error(`  ${e.instancePath || "/"} ${e.message}`);
    process.exit(1);
  }

  const imagesDir = join(dirname(bundlePath), "images");
  const imageFiles = existsSync(imagesDir)
    ? readdirSync(imagesDir).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).map((f) => `images/${f}`)
    : [];
  const plan = planImport(bundle, fetchRefs(), { imageFiles });
  for (const w of plan.warnings) console.log(`注意 ${w}`);
  if (plan.errors.length > 0) {
    console.error("取り込めない（何も書いていない）:");
    for (const e of plan.errors) console.error(`  ${e}`);
    process.exit(1);
  }

  const summary = `エリア追加 ${plan.areas.length} / カテゴリ追加 ${plan.categoryDefs.length} / 公開 ${plan.spots.length} 件 / 候補 ${plan.records.length - plan.spots.length} 件 / 取り下げ ${plan.removeRefs.length} 件 / 事実 ${plan.facts.length} / 写真 ${plan.photos.length} / 料金 ${plan.prices.length}`;
  if (dryRun) {
    // 写真は置かず、残りを DB で実行してからロールバックする
    const sqlFile = join(work, "dry-run.sql");
    writeFileSync(sqlFile, renderSql(plan, [], { commit: false }));
    const r = supabase(["db", "query", "--linked", "-f", sqlFile]);
    if (!r.ok) {
      console.error(`DB が受け付けない（ロールバック済み）:\n${r.stderr}`);
      process.exit(1);
    }
    console.log(`dry-run: ${summary}（DB で実行してロールバックした。写真は置いていない）`);
    return;
  }

  const base = projectUrl();
  const photos = await uploadPhotos(plan.photos, dirname(bundlePath), {
    readFile: async (p) => new Uint8Array(await readFile(p)),
    download,
    upload,
    publicUrl: (p) => `${base}/storage/v1/object/public/${BUCKET}/${p}`,
  });
  for (const e of photos.errors) console.log(`注意 ${e}`);

  const sqlFile = join(work, "import.sql");
  writeFileSync(sqlFile, renderSql(plan, photos.rows));
  const r = supabase(["db", "query", "--linked", "-f", sqlFile]);
  if (!r.ok) {
    console.error(`投入に失敗した（DB はロールバック済み）:\n${r.stderr}`);
    process.exit(1);
  }
  console.log(`投入した: ${summary.replace(/写真 \d+/, `写真 ${photos.rows.length}`)}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => rmSync(work, { recursive: true, force: true }));
