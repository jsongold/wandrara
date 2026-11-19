import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { invalidateDests } from "./invalidate";

describe("invalidateDests", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
  });

  it("一覧（catalog）と dest ごとの詳細を、古い内容を出さない指定（expire: 0）で捨てる。同じ slug は 1 回", () => {
    invalidateDests(["a", "b", "a"]);
    expect(revalidateTag.mock.calls).toEqual([
      ["catalog", { expire: 0 }],
      ["dest:a", { expire: 0 }],
      ["dest:b", { expire: 0 }],
    ]);
  });

  it("slug が無ければ何も捨てない", () => {
    invalidateDests([]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidateTag が投げても呼び側には投げない", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    revalidateTag.mockImplementation(() => {
      throw new Error("boom");
    });
    invalidateDests(["a"]);
    expect(err).toHaveBeenCalledTimes(1);
  });
});
