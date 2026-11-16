import { describe, expect, it } from "vitest";
import { filterMark } from "./CurrentFilterDisplay";

describe("filterMark", () => {
  it("名前の最初の 1 文字", () => {
    expect(filterMark("箱根・芦ノ湖")).toBe("箱");
    expect(filterMark("全エリア")).toBe("全");
    expect(filterMark("Hakone")).toBe("H");
  });
  it("空なら空", () => {
    expect(filterMark("  ")).toBe("");
  });
  it("サロゲートペアも 1 文字で切る", () => {
    expect(filterMark("𠮷野")).toBe("𠮷");
  });
});
