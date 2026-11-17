import { describe, expect, it, vi } from "vitest";
import { startLazyMap } from "./lazy-map";

/** 見張り・読み込み・地図の偽物。near() で「近づいた」、resolve/reject で読み込みを終える */
function fakes() {
  let onNear: () => void = () => {};
  const disconnect = vi.fn();
  const map = { remove: vi.fn() };
  const create = vi.fn(() => map);
  let resolve: (f: () => typeof map) => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const load = vi.fn(() => new Promise<() => typeof map>((ok, ng) => ((resolve = ok), (reject = ng))));
  const onError = vi.fn();
  const observe = (cb: () => void) => ((onNear = cb), disconnect);
  return { near: () => onNear(), disconnect, map, create, load, onError, observe, resolve: () => resolve(create), reject: (e: unknown) => reject(e) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("startLazyMap", () => {
  it("近づくまでは読まない。近づいたら一度だけ読み、見張りを止めて地図を作る", async () => {
    const f = fakes();
    startLazyMap(f);
    expect(f.load).not.toHaveBeenCalled();
    f.near();
    f.near();
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.disconnect).toHaveBeenCalled();
    f.resolve();
    await tick();
    expect(f.create).toHaveBeenCalledTimes(1);
  });

  it("読み込み中に片付けたら地図を作らない", async () => {
    const f = fakes();
    const cleanup = startLazyMap(f);
    f.near();
    cleanup();
    f.resolve();
    await tick();
    expect(f.create).not.toHaveBeenCalled();
  });

  it("作った後に片付けたら remove し、見張りも止める", async () => {
    const f = fakes();
    const cleanup = startLazyMap(f);
    f.near();
    f.resolve();
    await tick();
    cleanup();
    expect(f.map.remove).toHaveBeenCalledTimes(1);
    expect(f.disconnect).toHaveBeenCalled();
  });

  it("読めなかったら onError。片付け後の失敗は知らせない", async () => {
    const f = fakes();
    startLazyMap(f);
    f.near();
    f.reject(new Error("offline"));
    await tick();
    expect(f.onError).toHaveBeenCalledTimes(1);
    expect(f.create).not.toHaveBeenCalled();

    const g = fakes();
    const cleanup = startLazyMap(g);
    g.near();
    cleanup();
    g.reject(new Error("offline"));
    await tick();
    expect(g.onError).not.toHaveBeenCalled();
  });

  it("地図を作る時点で失敗したら（WebGL が無いなど）onError", async () => {
    const f = fakes();
    f.create.mockImplementation(() => {
      throw new Error("WebGL");
    });
    startLazyMap(f);
    f.near();
    f.resolve();
    await tick();
    expect(f.onError).toHaveBeenCalledTimes(1);
  });

  it("見張りを始めた直後に近づいても、見張りは止まる", () => {
    const disconnect = vi.fn();
    startLazyMap({ observe: (cb) => (cb(), disconnect), load: () => new Promise(() => {}), onError: vi.fn() });
    expect(disconnect).toHaveBeenCalled();
  });
});
