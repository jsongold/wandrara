import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authenticateCollector } from "@/lib/ingest/auth";
import { limiter } from "@/lib/limit";

const BUCKET = "dest-photos";
/** 1 リクエストの中で同時に Storage へ問い合わせる数 */
const STORAGE_CONCURRENCY = 10;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export async function POST(req: Request) {
  const db = adminClient();
  const auth = await authenticateCollector(req, db);
  if (!auth.ok) return NextResponse.json({ errors: [auth.error] }, { status: auth.status });

  let body: { files?: { sha256?: unknown; content_type?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ["JSON ではない"] }, { status: 400 });
  }
  const files = body?.files;
  if (!Array.isArray(files) || files.length === 0 || files.length > 50) {
    return NextResponse.json({ errors: ["/files は 1〜50 件の配列"] }, { status: 400 });
  }
  const errors: string[] = [];
  const items = files.map((f, i) => {
    const sha = typeof f?.sha256 === "string" ? f.sha256.toLowerCase() : "";
    const ext = typeof f?.content_type === "string" ? EXT[f.content_type] : undefined;
    if (!/^[0-9a-f]{64}$/.test(sha)) errors.push(`/files/${i}/sha256 は 64 桁の hex`);
    if (!ext) errors.push(`/files/${i}/content_type は jpeg / png / webp / avif`);
    return { sha256: sha, storage_key: `${sha}.${ext}` };
  });
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  try {
    const run = limiter(STORAGE_CONCURRENCY);
    const uploads = await Promise.all(
      items.map((it) =>
        run(async () => {
          const { data: found, error: listErr } = await db.storage.from(BUCKET).list("", { search: it.storage_key, limit: 1 });
          if (listErr) throw listErr;
          if (found?.some((o) => o.name === it.storage_key)) return { ...it, signed_url: null };
          const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(it.storage_key);
          if (error) throw error;
          return { ...it, signed_url: data.signedUrl };
        }),
      ),
    );
    return NextResponse.json({ uploads });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ errors: ["署名 URL の作成に失敗した"] }, { status: 500 });
  }
}
