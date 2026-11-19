import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSavesSession, type SavesState } from "./saves-session";
import { fakeDb } from "./supabase/fake-db";

// Supabase client の fake。auth の応答と保存の表（user_saves）を持つ
function fakeClient(opts: { userId: string | null; saved?: string[]; listFails?: boolean }) {
  const rows = new Set(opts.saved ?? []);
  // 一覧の読み取りは selectAll（order と range のページ送り）なので、fakeDb に生きた行を渡して読ませる。書き込みだけここで足す
  const table: { dest_id: string }[] = [];
  const sync = () => table.splice(0, table.length, ...[...rows].map((dest_id) => ({ dest_id })));
  sync();
  const reader = fakeDb({ user_saves: table }, opts.listFails ? { failAtFrom: 0 } : {}).db;
  let listener: ((e: string, s: { user: { id: string } } | null) => void) | null = null;
  const writes: string[] = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: opts.userId ? { id: opts.userId } : null } }),
      onAuthStateChange: (cb: typeof listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: () => (listener = null) } } };
      },
    },
    from: () => ({
      ...reader.from("user_saves"),
      insert: (r: { dest_id: string }) => (writes.push(`+${r.dest_id}`), rows.add(r.dest_id), sync(), Promise.resolve({ error: null })),
      delete: () => ({ eq: () => ({ eq: (_c: string, id: string) => (writes.push(`-${id}`), rows.delete(id), sync(), Promise.resolve({ error: null })) }) }),
    }),
  } as unknown as SupabaseClient;
  return { client, writes, emit: (id: string | null) => listener?.("SIGNED_IN", id ? { user: { id } } : null) };
}

function setup(hint: { v: boolean }, fc: ReturnType<typeof fakeClient>) {
  const loadClient = vi.fn(async () => fc.client);
  let state: SavesState = { userId: null, ready: false, ids: new Set() };
  const session = createSavesSession({ hasHint: () => hint.v, loadClient, onChange: (s) => (state = s) });
  return { session, loadClient, get: () => state };
}

describe("未ログイン（cookie 無し）", () => {
  it("初期化では client を読み込まず、ready で未ログイン", () => {
    const { session, loadClient, get } = setup({ v: false }, fakeClient({ userId: null }));
    session.init();
    expect(loadClient).not.toHaveBeenCalled();
    expect(get()).toMatchObject({ userId: null, ready: true });
  });
  it("初めて保存を押すと client を読まずにログインへ送る", async () => {
    const { session, loadClient } = setup({ v: false }, fakeClient({ userId: null }));
    session.init();
    expect(await session.toggle("d1")).toBe("login");
    expect(loadClient).not.toHaveBeenCalled();
  });
  it("別タブでログインして cookie が出たら、タブに戻ったとき読み込む", async () => {
    const hint = { v: false };
    const { session, loadClient, get } = setup(hint, fakeClient({ userId: "u1", saved: ["d9"] }));
    session.init();
    hint.v = true;
    session.recheck();
    await vi.waitFor(() => expect(get().ids.has("d9")).toBe(true));
    expect(loadClient).toHaveBeenCalledTimes(1);
    expect(get().userId).toBe("u1");
  });
  it("cookie が出たあと初めて保存を押すと、初期化して保存まで進む", async () => {
    const hint = { v: false };
    const fc = fakeClient({ userId: "u1" });
    const { session, get } = setup(hint, fc);
    session.init();
    hint.v = true;
    expect(await session.toggle("d1")).toBe("done");
    expect(fc.writes).toEqual(["+d1"]);
    expect(get().ids.has("d1")).toBe(true);
  });
});

describe("ログイン済み（cookie あり）", () => {
  it("初期化で client を読み、保存の一覧を読んで ready", async () => {
    const { session, loadClient, get } = setup({ v: true }, fakeClient({ userId: "u1", saved: ["a"] }));
    session.init();
    await vi.waitFor(() => expect(get().ready).toBe(true));
    expect(loadClient).toHaveBeenCalledTimes(1);
    expect(get().ids).toEqual(new Set(["a"]));
  });
  it("読み込み中に押しても、終わるのを待ってから保存・解除する", async () => {
    const fc = fakeClient({ userId: "u1", saved: ["a"] });
    const { session, get } = setup({ v: true }, fc);
    session.init();
    expect(await session.toggle("b")).toBe("done");
    expect(await session.toggle("a")).toBe("done");
    expect(fc.writes).toEqual(["+b", "-a"]);
    expect(get().ids).toEqual(new Set(["b"]));
  });
  it("期限切れの cookie：読み込んだが getUser が null なら未ログインとして ready、押すとログインへ", async () => {
    const { session, loadClient, get } = setup({ v: true }, fakeClient({ userId: null }));
    session.init();
    await vi.waitFor(() => expect(get().ready).toBe(true));
    expect(loadClient).toHaveBeenCalledTimes(1);
    expect(get().userId).toBeNull();
    expect(await session.toggle("d1")).toBe("login");
  });
  it("別タブでログアウトしたら未ログインになり、保存は空になる", async () => {
    const fc = fakeClient({ userId: "u1", saved: ["a"] });
    const { session, get } = setup({ v: true }, fc);
    session.init();
    await vi.waitFor(() => expect(get().ready).toBe(true));
    fc.emit(null);
    expect(get()).toMatchObject({ userId: null, ready: true });
    expect(get().ids.size).toBe(0);
  });
  it("別タブで別のユーザーでログインしたら、そのユーザーの一覧を読み直す", async () => {
    const fc = fakeClient({ userId: "u1", saved: ["a"] });
    const { session, get } = setup({ v: true }, fc);
    session.init();
    await vi.waitFor(() => expect(get().ready).toBe(true));
    fc.emit("u2");
    expect(get()).toMatchObject({ userId: "u2", ready: false });
    await vi.waitFor(() => expect(get().ready).toBe(true));
  });
  it("一覧の読み込みに失敗したら ready にならず、押しても何もしない", async () => {
    const fc = fakeClient({ userId: "u1", listFails: true });
    const { session, get } = setup({ v: true }, fc);
    session.init();
    expect(await session.toggle("d1")).toBe("ignored");
    expect(get().ready).toBe(false);
    expect(fc.writes).toEqual([]);
  });
  it("client の読み込みに失敗したら ignored。次に押したときやり直す", async () => {
    const fc = fakeClient({ userId: "u1" });
    const loadClient = vi.fn().mockRejectedValueOnce(new Error("chunk")).mockResolvedValue(fc.client);
    const session = createSavesSession({ hasHint: () => true, loadClient, onChange: () => {} });
    session.init();
    expect(await session.toggle("d1")).toBe("ignored");
    expect(await session.toggle("d1")).toBe("done");
    expect(loadClient).toHaveBeenCalledTimes(2);
  });
});
