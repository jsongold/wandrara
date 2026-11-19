import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authenticateCollector } from "@/lib/ingest/auth";
import { coreByPath } from "@/lib/ingest/cores";
import { registerDest } from "@/lib/ingest/apply";
import { invalidateDests } from "@/lib/invalidate";

export async function POST(req: Request, { params }: { params: Promise<{ core: string }> }) {
  const { core: path } = await params;
  const core = coreByPath(path);
  if (!core) return NextResponse.json({ errors: ["not found"] }, { status: 404 });

  const db = adminClient();
  const auth = await authenticateCollector(req, db);
  if (!auth.ok) return NextResponse.json({ errors: [auth.error] }, { status: auth.status });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ errors: ["JSON ではない"] }, { status: 400 });
  }

  // 既存の dest を書き換えると公開が draft に戻る。書き込みを試みたら（例外でも）捨てる。中身が前回と同じ（unchanged）なら何も変わらない
  const touched: string[] = [];
  let changed = true;
  try {
    const r = await registerDest(db, core, json, auth.principal, undefined, (slug) => touched.push(slug));
    if (r.ok) changed = !r.unchanged;
    if (!r.ok) return NextResponse.json({ errors: r.errors }, { status: r.status });
    return NextResponse.json({ dest_id: r.dest_id, slug: r.slug, status: r.status, unchanged: r.unchanged });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ errors: ["書き込みに失敗した"] }, { status: 500 });
  } finally {
    if (changed) invalidateDests(touched);
  }
}
