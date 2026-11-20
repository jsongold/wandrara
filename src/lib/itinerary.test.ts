import { describe, expect, it } from "vitest";
import { buildItinerary } from "./itinerary";

const places = [
  { id: "inn", isStay: true },
  { id: "canoe", isStay: false },
  { id: "walk", isStay: false },
  { id: "stars", isStay: false },
  { id: "lodge", isStay: true },
];

describe("buildItinerary", () => {
  it("すごくいいを先に、宿は 1 日目の夜、ほかは前後に。うーん・未反応は入れない", () => {
    const items = buildItinerary(places, { lodge: "good", inn: "great", canoe: "good", stars: "great", walk: "hmm" });
    expect(items).toEqual([
      { slot: "day1-afternoon", id: "stars", great: true },
      { slot: "day1-night", id: "inn", great: true },
      { slot: "day2-morning", id: "canoe", great: false },
    ]);
  });
  it("宿のいいねが無ければ、夜は未定の枠", () => {
    expect(buildItinerary(places, { canoe: "good" })).toEqual([
      { slot: "day1-afternoon", id: "canoe", great: false },
      { slot: "day1-night", id: null, great: false },
    ]);
  });
});
