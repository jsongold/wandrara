import { describe, expect, it } from "vitest";
import { download } from "./download.ts";

/** 塊ごとに返す Response。pulled に読まれた塊の数が入る */
function streamed(chunks: number[], headers: Record<string, string> = {}) {
  const state = { pulled: 0, cancelled: false };
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (i >= chunks.length) return c.close();
      state.pulled++;
      c.enqueue(new Uint8Array(chunks[i++]));
    },
    cancel() {
      state.cancelled = true;
    },
  }, { highWaterMark: 0 }); // 読まれたときだけ pull する（先読みしない）
  const fetchFn = (async () => new Response(body, { headers })) as unknown as typeof fetch;
  return { fetchFn, state };
}

describe("download", () => {
  it("上限までなら全部つないで返す", async () => {
    const { fetchFn } = streamed([3, 4]);
    expect((await download("https://x/a.jpg", fetchFn, 10)).byteLength).toBe(7);
  });

  it("読んだ量が上限を超えたら、残りを読まずにやめる", async () => {
    const { fetchFn, state } = streamed([6, 6, 6, 6]);
    await expect(download("https://x/a.jpg", fetchFn, 10)).rejects.toThrow("を超えている");
    expect(state.pulled).toBeLessThan(4);
    expect(state.cancelled).toBe(true);
  });

  it("Content-Length が上限を超えていたら、本文を読まずにやめる", async () => {
    const { fetchFn, state } = streamed([6], { "content-length": "11534336" });
    await expect(download("https://x/a.jpg", fetchFn)).rejects.toThrow("10MB を超えている");
    expect(state.pulled).toBe(0);
  });

  it("HTTP の失敗は status を出す", async () => {
    const fetchFn = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    await expect(download("https://x/a.jpg", fetchFn)).rejects.toThrow("HTTP 404");
  });
});
