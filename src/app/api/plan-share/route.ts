// プランの場所ごとの、グループに送る文の材料（料金・行き方・予約リンク・地図）。?lang=&stay=<slug>&acts=<slug>,<slug>
// 文そのものは画面で作る（予約に使うサイトを選び直せるように）。リンクの土台はこのリクエストの origin
import { NextResponse, type NextRequest } from "next/server";
import { getDestDetail } from "@/lib/detail";
import { isLocale } from "@/lib/i18n/locale";
import { shareItemOf, type ShareRole } from "@/lib/share-plan";

const NO_STORE = { "Cache-Control": "no-store" };
const SLUG = /^[a-z0-9-]{1,80}$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const locale = sp.get("lang");
  if (!isLocale(locale)) return NextResponse.json({ error: "lang" }, { status: 400, headers: NO_STORE });
  const stay = sp.get("stay");
  const acts = (sp.get("acts") ?? "").split(",").filter(Boolean);
  const wanted: { slug: string; role: ShareRole }[] = [...(stay ? [{ slug: stay, role: "stay" as const }] : []), ...acts.map((slug) => ({ slug, role: "activity" as const }))];
  if (!wanted.length || wanted.length > 5 || !wanted.every((w) => SLUG.test(w.slug))) return NextResponse.json({ error: "slugs" }, { status: 400, headers: NO_STORE });
  try {
    const views = await Promise.all(wanted.map((w) => getDestDetail(w.slug, locale)));
    const items = wanted.flatMap((w, i) => (views[i] ? [shareItemOf(views[i]!, w.role, `${req.nextUrl.origin}/${locale}/d/${w.slug}`, locale)] : []));
    return NextResponse.json({ items }, { headers: NO_STORE });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "plan-share" }, { status: 502, headers: NO_STORE });
  }
}
