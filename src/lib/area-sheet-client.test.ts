import { describe, expect, it, vi } from "vitest";
import type { AreaSheetData } from "./area-sheet";
import { createAreaSheetLoader } from "./area-sheet-client";

const data: AreaSheetData = { areas: [{ id: "izu", label: "伊豆", subs: [] }], traits: { traits: [], byRegion: {} } };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("areaSheetLoader", () => {
  it("読み込み前は idle、load で loading、終わると ready。購読者に知らせる", async () => {
    const f = vi.fn().mockResolvedValue(data);
    const l = createAreaSheetLoader(f);
    const seen: string[] = [];
    l.subscribe(() => seen.push(l.get("ja").status));
    expect(l.get("ja").status).toBe("idle");
    l.load("ja");
    await tick();
    expect(seen).toEqual(["loading", "ready"]);
    expect(l.get("ja")).toEqual({ status: "ready", data });
    expect(f).toHaveBeenCalledWith("/api/area-sheet?lang=ja");
  });

  it("取得中・取得済みなら二重に取らない。言語ごとに別", async () => {
    const f = vi.fn().mockResolvedValue(data);
    const l = createAreaSheetLoader(f);
    l.load("ja");
    l.load("ja");
    await tick();
    l.load("ja");
    l.load("en");
    await tick();
    expect(f.mock.calls.map((c) => c[0])).toEqual(["/api/area-sheet?lang=ja", "/api/area-sheet?lang=en"]);
  });

  it("失敗は error。もう一度 load するとやり直す", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(data);
    const l = createAreaSheetLoader(f);
    l.load("ja");
    await tick();
    expect(l.get("ja").status).toBe("error");
    l.load("ja");
    await tick();
    expect(l.get("ja").status).toBe("ready");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("get は状態が変わらない間は同じ参照を返す（useSyncExternalStore の条件）", () => {
    const l = createAreaSheetLoader(vi.fn().mockResolvedValue(data));
    expect(l.get("ja")).toBe(l.get("ja"));
  });
});
