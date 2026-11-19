// フィードの表示とクリックの記録の受け口（#156）。ブラウザ（src/lib/feed-event-beacon.ts）がまとめて送り、書き先（src/lib/feed-event-store.ts。既定は feed_events）に渡す。
// 誰でも送れるので、形と件数だけ確かめる（数の水増しは防げない。点数の batch 側で session ごとの上限をかけるのが次の手）。
// 失敗してもブラウザは送り直さない（記録の欠けは許す。画面を止めない）
import { NextResponse } from "next/server";
import { z } from "zod";
import { FEED_EVENTS_MAX } from "@/lib/feed-event-beacon";
import { loadFeedEventStore, type FeedEventRow } from "@/lib/feed-event-store";

const short = z.string().max(64);
const Event = z.object({
  name: z.enum(["card_view", "card_click", "tile_click"]),
  destId: z.guid(),
  position: z.number().int().min(0).max(9999),
  fromDestId: z.guid().optional(),
  algorithm: z.string().min(1).max(200),
  mode: short,
  sort: short,
  area: short,
  cat: short,
});
const Body = z.object({ sessionId: z.guid(), events: z.array(Event).min(1).max(FEED_EVENTS_MAX) });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "json" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { sessionId, events } = parsed.data;
  const rows: FeedEventRow[] = events.map((e) => ({
    name: e.name,
    dest_id: e.destId,
    position: e.position,
    from_dest_id: e.name === "tile_click" ? (e.fromDestId ?? null) : null,
    session_id: sessionId,
    algorithm: e.algorithm,
    mode: e.mode,
    sort: e.sort,
    area: e.area,
    cat: e.cat,
  }));
  try {
    await loadFeedEventStore().write(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "write" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
