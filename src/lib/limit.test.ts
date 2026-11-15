import { describe, expect, it } from "vitest";
import { limiter } from "./limit.ts";

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("limiter", () => {
  it("同時に走るのは n 個まで", async () => {
    const run = limiter(3);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 10 }, () =>
        run(async () => {
          active++;
          peak = Math.max(peak, active);
          await tick();
          active--;
        }),
      ),
    );
    expect(peak).toBe(3);
  });

  it("結果は渡した順（Promise.all）、失敗は呼んだ側に返り、残りは続く", async () => {
    const run = limiter(2);
    const rs = await Promise.allSettled([1, 2, 3, 4].map((i) => run(async () => { await tick(); if (i === 2) throw new Error("x"); return i; })));
    expect(rs.map((r) => (r.status === "fulfilled" ? r.value : "err"))).toEqual([1, "err", 3, 4]);
  });

  it("n=1 なら 1 つずつ", async () => {
    const run = limiter(1);
    const order: string[] = [];
    await Promise.all(["a", "b"].map((s) => run(async () => { order.push(`${s}+`); await tick(); order.push(`${s}-`); })));
    expect(order).toEqual(["a+", "a-", "b+", "b-"]);
  });

  it("n が不正なら投げる", () => {
    expect(() => limiter(0)).toThrow();
  });
});
