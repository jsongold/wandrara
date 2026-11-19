// エリア選択シート（一覧・地図）のデータ（MS2c #110）。トップの props には載せず、クライアントがシートを開いたときに取る。
// 地域と特性のマスターから作る（dest の件数に比例しない）。公開の読み取りだけなので、ブラウザと CDN に 1 分持たせる（先に取っておく読み込みが、開き直しで毎回通信しないように）
// 1 分が切れた再訪は ETag で 304 にする（#143）。鮮度（最悪の遅れ）は変えず、23KB の取り直しだけを省く
// （宿・体験の分類から付く特性は公開・非公開で変わるが、載るのは「どのエリアが光るか」だけで、非公開の dest の中身は出ない）
import { NextResponse, type NextRequest } from "next/server";
import { getAreaSheetData } from "@/lib/data";
import { etagOf, matchesEtag } from "@/lib/etag";
import { isLocale } from "@/lib/i18n/locale";

const NO_STORE = { "Cache-Control": "no-store" };
const CACHE_1MIN = { "Cache-Control": "public, max-age=60, s-maxage=60" };

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("lang");
  if (!isLocale(locale)) return NextResponse.json({ error: "lang" }, { status: 400, headers: NO_STORE });
  try {
    const body = JSON.stringify(await getAreaSheetData(locale));
    const etag = etagOf(body);
    const headers = { ...CACHE_1MIN, ETag: etag };
    if (matchesEtag(req.headers.get("if-none-match"), etag)) return new NextResponse(null, { status: 304, headers });
    return new NextResponse(body, { headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "area-sheet" }, { status: 502, headers: NO_STORE });
  }
}
