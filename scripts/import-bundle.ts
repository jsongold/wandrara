// コレクターの content bundle を検証し、写真をバケットに置いて、下書き（draft）として Supabase に投入する。
// 使い方: pnpm import:bundle <bundle.json> [--dry-run]
//   --dry-run: 写真は置かず、DB で保存まで試してから取り消す
// 公開は pnpm spot:status <external_ref> published

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { adminClient } from "./lib/admin-client.ts";
import { planImport, type Bundle, type ImportPlan, type Refs } from "./import-bundle/plan.ts";
import { BUCKET, uploadPhotos, type PhotoRow } from "./import-bundle/photo.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function validateBundle(data: unknown): { bundle: Bundle } | { errors: string[] } {
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
  if (validate(data)) return { bundle: data as Bundle };
  return { errors: (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`) };
}

async function fetchRefs(db: SupabaseClient): Promise<Refs> {
  const [areas, categories, spots] = await Promise.all([
    db.from("areas").select("id"),
    db.from("categories").select("id"),
    db.from("spots").select("id, external_ref"),
  ]);
  const failed = [areas, categories, spots].find((r) => r.error);
  if (failed?.error) throw new Error(`DB の読み込みに失敗した: ${failed.error.message}`);
  return {
    areas: new Set((areas.data ?? []).map((a) => a.id as string)),
    categories: new Set((categories.data ?? []).map((c) => c.id as string)),
    spots: new Map((spots.data ?? []).map((s) => [s.id as string, (s.external_ref as string | null) ?? null])),
  };
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "user-agent": "wandrara-import" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function applyImport(db: SupabaseClient, plan: ImportPlan, photos: PhotoRow[], dryRun: boolean): Promise<void> {
  const p = {
    areas: plan.areas, categoryDefs: plan.categoryDefs, records: plan.records, removeRefs: plan.removeRefs, spots: plan.spots,
    categories: plan.categories, facts: plan.facts, photos, prices: plan.prices,
  };
  const { error } = await db.rpc("import_apply", { p, dry_run: dryRun });
  // dry-run は DB 関数が最後に例外を投げて取り消す
  if (error && !(dryRun && error.message === "WANDRARA_DRY_RUN")) throw new Error(`DB が受け付けない（取り消し済み）: ${error.message}`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("使い方: pnpm import:bundle <bundle.json> [--dry-run]");
    return 2;
  }
  const bundlePath = resolve(process.cwd(), file);
  const checked = validateBundle(JSON.parse(readFileSync(bundlePath, "utf8")));
  if ("errors" in checked) {
    console.error("スキーマに合わない:");
    for (const e of checked.errors) console.error(`  ${e}`);
    return 1;
  }

  const db = adminClient();
  const imagesDir = join(dirname(bundlePath), "images");
  const imageFiles = existsSync(imagesDir)
    ? readdirSync(imagesDir).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).map((f) => `images/${f}`)
    : [];
  const plan = planImport(checked.bundle, await fetchRefs(db), { imageFiles });
  for (const w of plan.warnings) console.log(`注意 ${w}`);
  if (plan.errors.length > 0) {
    console.error("取り込めない（何も書いていない）:");
    for (const e of plan.errors) console.error(`  ${e}`);
    return 1;
  }
  const summary = (photoCount: number) =>
    `エリア追加・更新 ${plan.areas.length} / カテゴリ追加・更新 ${plan.categoryDefs.length} / 下書き ${plan.spots.length} 件 / 候補 ${plan.records.length - plan.spots.length} 件 / 取り下げ ${plan.removeRefs.length} 件 / 事実 ${plan.facts.length} / 写真 ${photoCount} / 料金 ${plan.prices.length}`;

  if (dryRun) {
    await applyImport(db, plan, [], true);
    console.log(`dry-run: ${summary(plan.photos.length)}（DB で試して取り消した。写真は置いていない）`);
    return 0;
  }

  const bucket = db.storage.from(BUCKET);
  const photos = await uploadPhotos(plan.photos, dirname(bundlePath), {
    readFile: async (p) => new Uint8Array(await readFile(p)),
    download,
    upload: async (bytes, objectPath, contentType) => {
      const { error } = await bucket.upload(objectPath, bytes, { contentType, upsert: false });
      // パスは中身のハッシュなので、すでにあれば同じ画像
      if (error && !/exists|duplicate/i.test(error.message)) throw new Error(error.message);
    },
    publicUrl: (p) => bucket.getPublicUrl(p).data.publicUrl,
  });
  for (const e of photos.errors) console.log(`注意 ${e}`);

  await applyImport(db, plan, photos.rows, false);
  console.log(`下書きとして投入した: ${summary(photos.rows.length)}`);
  for (const s of plan.spots) console.log(`  公開するには: pnpm spot:status ${s.external_ref} published`);
  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; },
);
