// 予約を Agent（ブラウザを操作できる ChatGPT の agent・Claude in Chrome など）に任せるための指示を作る（純関数）。
// 本人がそばにいる前提：決済・確定の前で止めて本人の OK を待つ。カード・個人情報は Agent が勝手に入れない。
// 結果は決まった形で返してもらう（あとで WANDRARA に取り込めるように）
import { linksFor, type SiteId } from "../booking-sites";
import type { Final } from "../final";

export type HandoffText = {
  intro: string[];
  trip: (label: string) => string;
  noTrip: string;
  itemsTitle: string;
  item: (n: number, role: string, title: string) => string;
  link: (label: string, url: string) => string;
  noLink: string;
  rules: string[];
  reportTitle: string;
  report: string[];
  itineraryStart: string;
  itineraryEnd: string;
};

/** 場所ごとの予約リンク：選んだサイトの順を先に、残りはそのあと（同じ URL は 1 つ） */
export function orderedLinks(bookings: Final["items"][number]["bookings"], sites: SiteId[]): Final["items"][number]["bookings"] {
  const seen = new Set<string>();
  return [...linksFor(bookings, sites), ...bookings].filter((b) => (seen.has(b.url) ? false : (seen.add(b.url), true)));
}

export function bookingHandoff(final: Pick<Final, "items" | "trip" | "text">, t: HandoffText, sites: SiteId[] = []): string {
  const items = final.items.map((it, i) => {
    const links = orderedLinks(it.bookings, sites);
    return [t.item(i + 1, it.role, it.title), ...(links.length ? links.map((l) => t.link(l.label, l.url)) : [t.noLink])].join("\n");
  });
  return [
    t.intro.join("\n"),
    final.trip ? t.trip(final.trip) : t.noTrip,
    [t.itemsTitle, ...items].join("\n\n"),
    t.rules.join("\n"),
    [t.reportTitle, ...t.report].join("\n"),
    [t.itineraryStart, final.text, t.itineraryEnd].join("\n"),
  ].join("\n\n");
}
