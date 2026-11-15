// bundle を dest ごとに全部確かめ、エラーを「/dests/<i>/... 理由」の形で返す（写真の読み込みは readPhoto に任せる）。
// - bundle 全体（bundle_version・collector など）は 1 回だけ確かめる。dest は正しい見出しを付けて 1 件ずつ確かめる
//   （見出しの誤りで dest のエラーが隠れないように）
// - 形が合う dest は、中身の決まりに合わなくても写真を読む（1 回の実行で全部の問題を出す）
import { parseBundle, parseBundleShape } from "../../src/lib/ingest/bundle.ts";
import type { BundlePhoto } from "../import-bundle/collect.ts";

/** dest を 1 件ずつ確かめるときに付ける見出し（形として正しいもの） */
const HEADER = { bundle_version: "2", collector: "bundle-validate", collected_at: "1970-01-01T00:00:00Z" };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function validateBundle(
  raw: unknown,
  readPhoto: (p: BundlePhoto) => Promise<unknown>,
  run: <T>(fn: () => Promise<T>) => Promise<T> = (fn) => fn(),
): Promise<string[]> {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const errors: string[] = [];

  // bundle 全体：dests を空にして見出しだけ確かめる
  if (!root) errors.push("/ bundle は JSON のオブジェクト");
  else {
    const top = parseBundleShape({ ...root, dests: [] });
    if (!top.ok) errors.push(...top.errors);
  }
  if (root && !Array.isArray(root.dests)) errors.push("/dests は配列");
  const dests = root && Array.isArray(root.dests) ? (root.dests as unknown[]) : [];

  const photoTargets: { i: number; photos: BundlePhoto[] }[] = [];
  dests.forEach((d, i) => {
    const one = { ...HEADER, dests: [d] };
    const shape = parseBundleShape(one);
    const remap = (es: string[]) => es.filter((e) => e.startsWith("/dests/0")).map((e) => e.replace(/^\/dests\/0/, `/dests/${i}`));
    if (!shape.ok) {
      errors.push(...remap(shape.errors));
      return;
    }
    photoTargets.push({ i, photos: (shape.value.dests[0].photos ?? []) as BundlePhoto[] });
    const full = parseBundle(one);
    if (!full.ok) errors.push(...remap(full.errors));
  });

  // 同じ ref の重なり（bundle 全体で見る）
  const firstRef = new Map<string, number>();
  dests.forEach((d, i) => {
    const ref = d && typeof d === "object" && typeof (d as { ref?: unknown }).ref === "string" ? (d as { ref: string }).ref : "";
    if (!ref) return;
    const j = firstRef.get(ref);
    if (j === undefined) firstRef.set(ref, i);
    else errors.push(`/dests/${i}/ref ref ${ref} が /dests/${j} と重なっている。1 つの bundle に同じ ref は 1 回だけ`);
  });

  // 写真：形が合う dest の写真を全部読む
  await Promise.all(
    photoTargets.flatMap(({ i, photos }) =>
      photos.map((p, k) =>
        run(() => readPhoto(p)).catch((e) => {
          errors.push(`/dests/${i}/photos/${k} 写真を読めない（${p.file ?? p.url}: ${msg(e)}）`);
        }),
      ),
    ),
  );
  return errors;
}
