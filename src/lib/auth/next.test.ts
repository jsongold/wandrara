import { describe, expect, it } from "vitest";
import { callbackTargets, localizedNextPath, safeNextPath } from "./next";

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

describe("localizedNextPath", () => {
  it("言語つきのパスはそのまま", () => {
    expect(localizedNextPath("/en/account", "ja")).toBe("/en/account");
    expect(localizedNextPath("/ja?mode=do", "en")).toBe("/ja?mode=do");
  });
  it("言語の無いパスには今の言語を付ける", () => {
    expect(localizedNextPath("/d/x", "en")).toBe("/en/d/x");
    expect(localizedNextPath("/?mode=do", "en")).toBe("/en?mode=do");
  });
  it("無い・外部・/ は今の言語のトップ", () => {
    for (const v of [null, undefined, "", "/", "//evil.com", "https://evil.com"]) {
      expect(localizedNextPath(v, "en")).toBe("/en");
    }
  });
});

describe("callbackTargets", () => {
  it("next の言語で戻り、失敗もその言語のエラー画面", () => {
    expect(callbackTargets("/en/account", "ja")).toEqual({ next: "/en/account", error: "/en/auth/error" });
  });
  it("next に言語が無い・無効なら fallback の言語", () => {
    expect(callbackTargets("/d/x", "en")).toEqual({ next: "/en/d/x", error: "/en/auth/error" });
    expect(callbackTargets(null, "ja")).toEqual({ next: "/ja", error: "/ja/auth/error" });
    expect(callbackTargets("//evil.com", "en")).toEqual({ next: "/en", error: "/en/auth/error" });
  });
});
