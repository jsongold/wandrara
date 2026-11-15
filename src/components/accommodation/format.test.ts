import { describe, expect, it } from "vitest";
import type { RoomView } from "@/lib/accommodation/view";
import { joinLabels, priceNote, roomSummary, yen } from "./format";

const room = (over: Partial<RoomView>): RoomView => ({
  key: "r",
  label: "ツイン",
  capacity: null,
  areaSqm: null,
  tatami: null,
  styleLabel: null,
  view: null,
  smokingLabel: null,
  bedrooms: [],
  photos: [],
  ...over,
});

describe("format", () => {
  it("yen は 3 桁ごとに区切る", () => {
    expect(yen(170000)).toBe("170,000");
  });

  it("joinLabels は同じものを 1 つにし、最後を「と」でつなぐ", () => {
    expect(joinLabels(["諸経費"])).toBe("諸経費");
    expect(joinLabels(["諸経費", "入湯税", "諸経費"])).toBe("諸経費と入湯税");
    expect(joinLabels(["A", "B", "C"])).toBe("A・BとC");
  });

  it("priceNote は別料金があれば足す", () => {
    expect(priceNote([])).toBe("人数と日によって変わります。");
    expect(
      priceNote([
        { label: "諸経費", text: "x" },
        { label: "入湯税", text: "y" },
      ]),
    ).toBe("人数と日によって変わります。別途、諸経費と入湯税がかかります。");
  });

  it("priceNote は宿泊料に込みの料金を「別途」に数えない", () => {
    expect(
      priceNote([
        { label: "諸経費", text: "x" },
        { label: "入湯税", text: "y（宿泊料に込み）", includedInRoom: true },
      ]),
    ).toBe("人数と日によって変わります。別途、諸経費がかかります。");
    expect(priceNote([{ label: "入湯税", text: "y（宿泊料に込み）", includedInRoom: true }])).toBe("人数と日によって変わります。");
  });

  it("roomSummary は定員だけなら「名まで」、ほかもあれば・でつなぐ", () => {
    expect(roomSummary(room({ capacity: 12 }))).toBe("12 名まで");
    expect(roomSummary(room({ capacity: 2, areaSqm: 24, bedrooms: [{ label: "寝室 1", beds: "シングル 2" }] }))).toBe("2 名・24㎡・シングル 2");
    expect(
      roomSummary(
        room({
          capacity: 12,
          bedrooms: [
            { label: "寝室 1", beds: "ダブル 1" },
            { label: "寝室 2", beds: "セミダブル 2" },
          ],
        }),
      ),
    ).toBe("12 名・寝室 2 室");
    expect(roomSummary(room({}))).toBe("");
  });
});
