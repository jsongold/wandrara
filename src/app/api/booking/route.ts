// ファイナルの予約ボタンから呼ぶ。予約したい件ごとに、扱える予約の仕方（executor）で予約し、できた・できなかったを返す。
// 今の executor は手続きのリンクを返すだけ（src/lib/booking/executors.ts）。実際の予約・決済はしない
import { NextResponse, type NextRequest } from "next/server";
import { siteOf } from "@/lib/booking-sites";
import { EXECUTORS } from "@/lib/booking/executors";
import { runBookings } from "@/lib/booking/run";
import type { BookingRequest } from "@/lib/booking/types";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX = 10;

const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);
const httpUrl = (v: unknown) => {
  const s = str(v, 2000);
  try {
    return s && /^https?:$/.test(new URL(s).protocol) ? s : null;
  } catch {
    return null;
  }
};

/** 受け取った件を検査する（形が違う・URL でないものは捨てる）。サイトは URL から決め直す */
function parseRequests(body: unknown): BookingRequest[] | null {
  const list = (body as { requests?: unknown })?.requests;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX) return null;
  const out: BookingRequest[] = [];
  for (const r of list as Record<string, unknown>[]) {
    const url = httpUrl(r?.url);
    const placeTitle = str(r?.placeTitle, 200);
    if (!url || !placeTitle) return null;
    const label = str(r?.label, 100) ?? "";
    out.push({ placeTitle, label, url, site: siteOf({ url, isOfficial: r?.site === "official" }), trip: str(r?.trip, 200) ?? "" });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const reqs = parseRequests(await req.json().catch(() => null));
  if (!reqs) return NextResponse.json({ error: "requests" }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ results: await runBookings(reqs, EXECUTORS) }, { headers: NO_STORE });
}
