import { NextResponse } from "next/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { authenticateCollector } from "@/lib/ingest/auth";
import { setStatus } from "@/lib/ingest/publish";

const Body = z.object({
  refs: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)).min(1).max(100),
  status: z.enum(["published", "draft"]),
});

export async function POST(req: Request) {
  const db = adminClient();
  const auth = await authenticateCollector(req, db);
  if (!auth.ok) return NextResponse.json({ errors: [auth.error] }, { status: auth.status });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ errors: ["JSON ではない"] }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.issues.map((i) => `/${i.path.join("/")} ${i.message}`) },
      { status: 400 },
    );
  }

  try {
    const results = await setStatus(db, parsed.data.refs, parsed.data.status, auth.principal);
    return NextResponse.json({ results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ errors: ["書き込みに失敗した"] }, { status: 500 });
  }
}
