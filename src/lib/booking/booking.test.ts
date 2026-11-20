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

describe("bookingHandoff", async () => {
  const { bookingHandoff, orderedLinks } = await import("./handoff");
  const t = {
    intro: ["指示"],
    trip: (x: string) => `条件：${x}`,
    noTrip: "条件：本人に聞く",
    itemsTitle: "予約するもの",
    item: (n: number, role: string, title: string) => `${n}. ${role}：${title}`,
    link: (label: string, url: string) => `- ${label} ${url}`,
    noLink: "- リンクなし",
    rules: ["守ること"],
    reportTitle: "報告",
    report: ["- 名前：予約できた"],
    itineraryStart: "<<<",
    itineraryEnd: ">>>",
  };
  const f = {
    trip: "2 人・11 月",
    text: "旅程",
    items: [
      { role: "泊まる", title: "宿", bookings: [{ label: "公式", url: "https://o/1", site: "official" as const }, { label: "楽天", url: "https://r/1", site: "rakuten" as const }] },
      { role: "過ごす", title: "草原", bookings: [] },
    ],
  };
  it("選んだサイトを先にしたリンク、リンクの無い場所、条件、守ること、報告の形、旅程の順", () => {
    expect(bookingHandoff(f, t, ["rakuten"])).toBe(
      "指示\n\n条件：2 人・11 月\n\n予約するもの\n\n1. 泊まる：宿\n- 楽天 https://r/1\n- 公式 https://o/1\n\n2. 過ごす：草原\n- リンクなし\n\n守ること\n\n報告\n- 名前：予約できた\n\n<<<\n旅程\n>>>",
    );
  });
  it("条件が無ければ本人に聞く。同じ URL は 1 つ", () => {
    expect(bookingHandoff({ ...f, trip: "" }, t)).toContain("条件：本人に聞く");
    expect(orderedLinks([...f.items[0].bookings, f.items[0].bookings[0]], ["official"]).map((l) => l.url)).toEqual(["https://o/1", "https://r/1"]);
  });
});
