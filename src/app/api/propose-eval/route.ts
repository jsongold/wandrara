// 提案の評価（開発用。本番では 404）。提案ページと同じデータで、決まった振る舞いの利用者に提案ルームを最後まで動かし、指標を返す。
// ?lang=ja&t=&area=&p=&m=&o=（提案ページと同じ）
import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/data";
import { messages } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/locale";
import { loadRoom } from "@/lib/plan-room-load";
import { conditionFeatures, defaultStrategies } from "@/lib/propose";
import { simulate } from "@/lib/propose/simulate";
import { evaluate } from "@/lib/propose-eval";
import { MATCH } from "@/lib/suggest-vocab";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const locale = sp.lang;
  if (!isLocale(locale)) return NextResponse.json({ error: "lang" }, { status: 400, headers: NO_STORE });
  const room = await loadRoom(locale, sp);
  const { candidates, conditions, labels } = room.data;
  const sim = simulate(candidates, conditions, defaultStrategies(messages(locale).plan.lead, (f) => labels[f] ?? f));
  const ids = candidates.map((c) => c.id);
  const { data } = ids.length ? await supabase().from("dest_cards").select("dest_id, lat, lng").in("dest_id", ids) : { data: [] };
  const coords = Object.fromEntries((data ?? []).filter((r) => r.lat !== null && r.lng !== null).map((r) => [r.dest_id as string, { lat: Number(r.lat), lng: Number(r.lng) }]));
  const destTraitIds = new Set(candidates.flatMap((c) => c.features.filter((f) => f.startsWith("dest:")).map((f) => f.slice(5))));
  const metrics = evaluate({ picked: room.picked, conditions, candidates, sim, coords }, (k) => conditionFeatures([k], MATCH, destTraitIds));
  const nameOf = (id: string) => candidates.find((c) => c.id === id)?.name ?? id;
  return NextResponse.json(
    {
      name: room.name,
      trip: room.trip,
      conditions: conditions.map((f) => labels[f] ?? f),
      algorithm: sim.algorithm,
      metrics,
      rounds: sim.rounds.map((r) => ({ cause: r.cause, lead: r.lead, cards: r.ids.map((id) => ({ name: nameOf(id), features: candidates.find((c) => c.id === id)?.features.map((f) => labels[f] ?? f) ?? [] })) })),
      plan: sim.goal?.stay ? [sim.goal.stay, ...sim.goal.activities].map(nameOf) : [],
    },
    { headers: NO_STORE },
  );
}
