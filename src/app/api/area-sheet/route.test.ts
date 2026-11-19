// /api/area-sheet：エリア選択シートのデータ。成功はブラウザと CDN に 1 分、不正・失敗は持たせない（MS2c）
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAreaSheetData } = vi.hoisted(() => ({ getAreaSheetData: vi.fn() }));
vi.mock("@/lib/data", () => ({ getAreaSheetData }));

import { NextRequest } from "next/server";
import { GET } from "./route";

const get = (qs: string) => GET(new NextRequest(`http://x/api/area-sheet?${qs}`));

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

  it("不正な lang は 400、失敗は 502。どちらも持たせない", async () => {
    const bad = await get("lang=xx");
    expect([bad.status, bad.headers.get("Cache-Control")]).toEqual([400, "no-store"]);
    getAreaSheetData.mockImplementation(async () => { throw new Error("db"); });
    const failed = await get("lang=ja");
    expect([failed.status, failed.headers.get("Cache-Control")]).toEqual([502, "no-store"]);
  });
});
