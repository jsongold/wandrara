import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next";

describe("safeNextPath", () => {
  it("同じサイトの相対パスは通す", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/a?b=1#c")).toBe("/a?b=1#c");
  });
  it("他は / にする", () => {
    for (const v of [null, undefined, "", "account", "//evil.com", "/\\evil.com", "https://evil.com", "/\n//evil.com"]) {
      expect(safeNextPath(v)).toBe("/");
    }
  });
});
