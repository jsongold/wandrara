// フィードの点数の batch（#156）。Vercel Cron が 1 日 1 回呼ぶ（vercel.json）。
// Vercel は環境変数 CRON_SECRET を Authorization: Bearer <CRON_SECRET> で付けて呼ぶ。未設定・不一致は 401
import { NextResponse, type NextRequest } from "next/server";
import { runFeedScoreBatch } from "@/lib/feed-score-batch";
import { adminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runFeedScoreBatch(adminClient());
    console.info(`feed-score: ${JSON.stringify(result)}`);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "feed-score" }, { status: 500 });
  }
}
