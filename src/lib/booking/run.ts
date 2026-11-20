// 予約を流す（純関数に近い：実行の仕方は executors で渡す）。1 件ずつ、扱える最初の executor に任せ、例外は failed にする
import type { BookingExecutor, BookingRequest, BookingResult } from "./types";
import type { Final } from "../final";
import { linksFor } from "../booking-sites";
import type { SiteId } from "../booking-sites";

/** 手続きのリンクを返すだけ（自動では予約しない）。どのサイトでも扱える最後の受け皿 */
export const manualExecutor: BookingExecutor = {
  name: "manual@1",
  canHandle: () => true,
  book: async (req) => ({ ...req, status: "needs_user", reason: "not_supported", executor: "manual@1" }),
};

/** ファイナルから予約したい件を作る：場所ごとに 1 件。選んだサイトの順でリンクを選び、無ければ最初のリンク。予約リンクの無い場所は入れない */
export function requestsOf(final: Pick<Final, "items" | "trip">, sites: SiteId[] = []): BookingRequest[] {
  return final.items.flatMap((it) => {
    const link = linksFor(it.bookings, sites)[0] ?? it.bookings[0];
    return link ? [{ placeTitle: it.title, label: link.label, url: link.url, site: link.site, trip: final.trip }] : [];
  });
}

export async function runBookings(reqs: BookingRequest[], executors: BookingExecutor[]): Promise<BookingResult[]> {
  const out: BookingResult[] = [];
  for (const req of reqs) {
    const ex = executors.find((e) => e.canHandle(req)) ?? manualExecutor;
    try {
      out.push(await ex.book(req));
    } catch {
      out.push({ ...req, status: "failed", reason: "error", executor: ex.name });
    }
  }
  return out;
}

/** 予約できた・できなかった（本人の手続きと失敗）の数 */
export function summarize(results: BookingResult[]): { booked: number; notBooked: number } {
  const booked = results.filter((r) => r.status === "booked").length;
  return { booked, notBooked: results.length - booked };
}
