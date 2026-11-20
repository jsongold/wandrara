import { describe, expect, it } from "vitest";
import { manualExecutor, requestsOf, runBookings, summarize } from "./run";
import type { BookingExecutor } from "./types";

const final = {
  trip: "2 人・11 月",
  items: [
    { role: "泊まる", title: "宿", bookings: [{ label: "公式", url: "https://o/1", site: "official" as const }, { label: "楽天", url: "https://r/1", site: "rakuten" as const }] },
    { role: "過ごす", title: "草原", bookings: [] },
  ],
};

describe("booking", () => {
  it("場所ごとに 1 件。選んだサイトの順でリンクを選ぶ。予約リンクの無い場所は入れない", () => {
    expect(requestsOf(final, ["rakuten"])).toEqual([{ placeTitle: "宿", label: "楽天", url: "https://r/1", site: "rakuten", trip: "2 人・11 月" }]);
    expect(requestsOf(final, [])[0].url).toBe("https://o/1");
  });
  it("扱える executor に任せ、無ければ手続きのリンクを返す。例外は failed", async () => {
    const auto: BookingExecutor = { name: "auto@0", canHandle: (r) => r.site === "rakuten", book: async (r) => ({ ...r, status: "booked", reason: "booked", confirmation: "X1", executor: "auto@0" }) };
    const boom: BookingExecutor = { name: "boom@0", canHandle: (r) => r.site === "official", book: async () => Promise.reject(new Error("x")) };
    const reqs = [...requestsOf(final, ["rakuten"]), ...requestsOf(final, ["official"])];
    const res = await runBookings(reqs, [auto, boom, manualExecutor]);
    expect(res.map((r) => [r.status, r.executor])).toEqual([["booked", "auto@0"], ["failed", "boom@0"]]);
    expect(summarize(res)).toEqual({ booked: 1, notBooked: 1 });
    expect((await runBookings(reqs.slice(0, 1), []))[0]).toMatchObject({ status: "needs_user", reason: "not_supported", executor: "manual@1" });
  });
});
