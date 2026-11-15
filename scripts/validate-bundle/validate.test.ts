import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateBundle } from "./validate.ts";

const fixture = () => JSON.parse(readFileSync(new URL("../import-bundle/fixtures/bundle.json", import.meta.url), "utf8"));
const okPhoto = async () => "ok";

describe("validateBundle", () => {
  it("決まりを満たす bundle はエラーなし", async () => {
    expect(await validateBundle(fixture(), okPhoto)).toEqual([]);
  });

  it("見出し（collector）の誤りがあっても、dest のエラーは隠れない", async () => {
    const b = fixture();
    delete b.collector;
    delete b.dests[0].core.lat;
    const errors = await validateBundle(b, okPhoto);
    expect(errors.some((e) => e.startsWith("/collector"))).toBe(true);
    expect(errors.some((e) => e.startsWith("/dests/0/core/lat"))).toBe(true);
  });

  it("中身の決まりに合わない dest も、写真は読む（1 回で全部の問題を出す）", async () => {
    const b = fixture();
    delete b.dests[0].core.lat;
    b.dests[0].photos = [{ file: "missing.png" }];
    const errors = await validateBundle(b, async () => {
      throw new Error("ENOENT");
    });
    expect(errors.some((e) => e.startsWith("/dests/0/core/lat"))).toBe(true);
    expect(errors.some((e) => e.startsWith("/dests/0/photos/0 写真を読めない（missing.png: ENOENT）"))).toBe(true);
  });

  it("形が合わない dest の写真は読まない（写真の項目そのものが読めないため）", async () => {
    const b = fixture();
    b.dests[0].core.kind = "castle";
    let reads = 0;
    const errors = await validateBundle(b, async () => void reads++);
    expect(reads).toBe(0);
    expect(errors.some((e) => e.startsWith("/dests/0/core/kind"))).toBe(true);
  });

  it("dest の番号を付け替え、同じ ref の重なりと、オブジェクトでない bundle を出す", async () => {
    const b = fixture();
    const second = structuredClone(b.dests[0]);
    second.ref = "WR-test-002";
    delete second.details.prices;
    b.dests = [b.dests[0], second, structuredClone(b.dests[0])];
    const errors = await validateBundle(b, okPhoto);
    expect(errors.some((e) => e.startsWith("/dests/1/details/prices"))).toBe(true);
    expect(errors.some((e) => e.startsWith("/dests/2/ref ref WR-test-001 が /dests/0 と重なっている"))).toBe(true);
    expect(await validateBundle([1, 2], okPhoto)).toEqual(["/ bundle は JSON のオブジェクト"]);
    expect(await validateBundle({ ...fixture(), dests: "x" }, okPhoto)).toContain("/dests は配列");
  });
});
