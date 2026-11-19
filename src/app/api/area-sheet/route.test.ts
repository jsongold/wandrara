// /api/area-sheet：エリア選択シートのデータ。成功はブラウザと CDN に 1 分、不正・失敗は持たせない（MS2c）
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAreaSheetData } = vi.hoisted(() => ({ getAreaSheetData: vi.fn() }));
vi.mock("@/lib/data", () => ({ getAreaSheetData }));

import { NextRequest } from "next/server";
import { GET } from "./route";

const get = (qs: string, headers?: Record<string, string>) => GET(new NextRequest(`http://x/api/area-sheet?${qs}`, { headers }));

describe("GET /api/area-sheet", () => {
  beforeEach(() => {
    getAreaSheetData.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("言語のデータを返し、ブラウザと CDN に 1 分持たせる", async () => {
    getAreaSheetData.mockResolvedValue({ areas: [], traits: { traits: [], byRegion: {} } });
    const r = await get("lang=en");
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=60");
    expect(getAreaSheetData).toHaveBeenCalledWith("en");
    expect(await r.json()).toEqual({ areas: [], traits: { traits: [], byRegion: {} } });
  });

  it("ETag を付け、If-None-Match が一致すれば本文なしの 304（Cache-Control も付け直す）。違えば 200", async () => {
    getAreaSheetData.mockResolvedValue({ areas: [], traits: { traits: [], byRegion: {} } });
    const etag = (await get("lang=ja")).headers.get("ETag")!;
    expect(etag).toMatch(/^"[\w-]+"$/);
    const hit = await get("lang=ja", { "if-none-match": `W/${etag}` });
    expect([hit.status, hit.headers.get("ETag"), hit.headers.get("Cache-Control"), await hit.text()]).toEqual([304, etag, "public, max-age=60, s-maxage=60", ""]);
    const stale = await get("lang=ja", { "if-none-match": '"old"' });
    expect(stale.status).toBe(200);
    // 本文が変われば ETag も変わる（エリア・特性の変更が再訪でも 304 で隠れない）
    getAreaSheetData.mockResolvedValue({ areas: [{ id: "x" }], traits: { traits: [], byRegion: {} } });
    const changed = await get("lang=ja", { "if-none-match": etag });
    expect(changed.status).toBe(200);
    expect(changed.headers.get("ETag")).not.toBe(etag);
  });

  it("不正な lang は 400、失敗は 502。どちらも持たせない", async () => {
    const bad = await get("lang=xx");
    expect([bad.status, bad.headers.get("Cache-Control")]).toEqual([400, "no-store"]);
    getAreaSheetData.mockImplementation(async () => { throw new Error("db"); });
    const failed = await get("lang=ja");
    expect([failed.status, failed.headers.get("Cache-Control")]).toEqual([502, "no-store"]);
  });
});
