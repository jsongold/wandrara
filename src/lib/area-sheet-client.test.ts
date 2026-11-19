import { describe, expect, it, vi } from "vitest";
import type { AreaSheetData } from "./area-sheet";
import { createAreaSheetLoader, HttpError } from "./area-sheet-client";

const data: AreaSheetData = { areas: [{ id: "izu", label: "伊豆", subs: [] }], traits: { traits: [], byRegion: {} } };
const tick = () => new Promise((r) => setTimeout(r, 0));
const noWait = { sleep: () => Promise.resolve() }; // 再試行の待ちを無くす

describe("areaSheetLoader", () => {
  it("読み込み前は idle、load で loading、終わると ready。購読者に知らせる", async () => {
    const f = vi.fn().mockResolvedValue(data);
    const l = createAreaSheetLoader(f, noWait);
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

  it("一時的な失敗は自動で再試行して、取れたら ready（その間は loading のまま）", async () => {
    const f = vi.fn().mockRejectedValueOnce(new HttpError(502, "u")).mockRejectedValueOnce(new Error("net")).mockResolvedValue(data);
    const l = createAreaSheetLoader(f, noWait);
    const seen: string[] = [];
    l.subscribe(() => seen.push(l.get("ja").status));
    l.load("ja");
    await tick();
    expect(seen).toEqual(["loading", "ready"]);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("再試行の上限まで失敗したら error。もう一度 load するとやり直す", async () => {
    const f = vi.fn().mockRejectedValue(new HttpError(500, "u"));
    const l = createAreaSheetLoader(f, noWait);
    l.load("ja");
    await tick();
    expect(l.get("ja").status).toBe("error");
    expect(f).toHaveBeenCalledTimes(3); // 最初 + 再試行 2 回
    f.mockResolvedValue(data);
    l.load("ja");
    await tick();
    expect(l.get("ja").status).toBe("ready");
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("4xx は直らないので再試行しない", async () => {
    const f = vi.fn().mockRejectedValue(new HttpError(400, "u"));
    const l = createAreaSheetLoader(f, noWait);
    l.load("ja");
    await tick();
    expect(l.get("ja").status).toBe("error");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("再試行の待ちは backoff の順で入る", async () => {
    const f = vi.fn().mockRejectedValue(new Error("net"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const l = createAreaSheetLoader(f, { sleep, backoffMs: [10, 20] });
    l.load("ja");
    await tick();
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([10, 20]);
  });

  it("get は状態が変わらない間は同じ参照を返す（useSyncExternalStore の条件）", () => {
    const l = createAreaSheetLoader(vi.fn().mockResolvedValue(data));
    expect(l.get("ja")).toBe(l.get("ja"));
  });
});
