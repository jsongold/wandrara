import { describe, expect, it, vi } from "vitest";
import { orFallback } from "./degrade";

describe("orFallback", () => {
  it("取れたらその値", async () => {
    expect(await orFallback(Promise.resolve([1]), [], "x")).toEqual([1]);
  });
  it("失敗したら代わりの値で続け、ログに残す", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await orFallback(Promise.reject(new Error("boom")), [], "カテゴリ")).toEqual([]);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
