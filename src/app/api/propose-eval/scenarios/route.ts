// 提案の評価のシナリオの一覧（開発用。本番では 404）。scripts/propose-eval が読む（スクリプトは @/ の import を解決できないため）
import { NextResponse } from "next/server";
import { SCENARIOS } from "@/lib/propose-eval-scenarios";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  return NextResponse.json(SCENARIOS, { headers: { "Cache-Control": "no-store" } });
}
