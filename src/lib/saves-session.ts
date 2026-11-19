// 保存状態の持ち主。Supabase client は「ログイン済みらしい cookie がある」か「保存ボタンを押した」ときまで読み込まない
// （未ログインの初期 JS から Supabase を外すため）。cookie はヒントで、ログインの検証は client の getUser が行う
import type { SupabaseClient } from "@supabase/supabase-js";
import { listSavedIds, setSaved } from "./saves";

export type SavesState = {
  userId: string | null;
  /** ログイン状態（と、ログイン中なら保存の一覧）を読み終えた */
  ready: boolean;
  ids: ReadonlySet<string>;
};

/** login：ログインが要る / done：操作した / ignored：読み込みに失敗・通信中などで何もしなかった */
export type ToggleResult = "login" | "done" | "ignored";

export type SavesSession = {
  /** 最初の状態を決める。cookie が無ければ client を読まずに未ログインで ready にする */
  init(): void;
  /** タブに戻ったときなど。別タブでログインした cookie が増えていたら読み込む */
  recheck(): void;
  toggle(destId: string): Promise<ToggleResult>;
  dispose(): void;
};

export function createSavesSession(deps: {
  hasHint: () => boolean;
  loadClient: () => Promise<SupabaseClient>;
  onChange: (state: SavesState) => void;
}): SavesSession {
  let state: SavesState = { userId: null, ready: false, ids: new Set() };
  let alive = true;
  let applied = false;
  let client: SupabaseClient | null = null;
  let started: Promise<void> | null = null;
  let listing: Promise<void> = Promise.resolve();
  let unsub: (() => void) | null = null;
  // 認証の世代。ログイン・ログアウト・切替のたびに進める。通信の結果が返ったとき世代が変わっていれば、古い結果として捨てる
  let gen = 0;
  // 通信中の dest。同じ dest の操作は終わるまで受け付けない（保存と解除が逆順に届くのを防ぐ）
  const pending = new Set<string>();

  function set(next: SavesState) {
    state = next;
    deps.onChange(state);
  }

  function apply(id: string | null) {
    if (applied && id === state.userId) return;
    applied = true;
    gen += 1;
    if (!id) {
      set({ userId: null, ready: true, ids: new Set() });
      return;
    }
    // 失敗したら ready にしない（保存済みが未保存に見えるのを防ぐ）。ボタンは押しても何もしない
    set({ userId: id, ready: false, ids: new Set() });
    listing = listSavedIds(client!)
      .then((s) => {
        if (!alive || state.userId !== id) return;
        set({ userId: id, ready: true, ids: s });
      })
      .catch(() => {});
  }

  async function run(): Promise<boolean> {
    try {
      const c = await deps.loadClient();
      if (!alive) return true;
      client = c;
      const { data } = c.auth.onAuthStateChange((_e, session) => apply(session?.user?.id ?? null));
      unsub = () => data.subscription.unsubscribe();
      const res = await c.auth.getUser();
      if (alive) apply(res.data.user?.id ?? null);
      await listing;
      return true;
    } catch {
      return false;
    }
  }

  // 読み込みは 1 回だけ。失敗したら次の機会にやり直せるよう空に戻す
  function start(): Promise<void> {
    if (!alive) return Promise.resolve();
    started ??= run().then((ok) => {
      if (!ok) started = null;
    });
    return started;
  }

  return {
    init() {
      if (deps.hasHint()) void start();
      else set({ userId: null, ready: true, ids: new Set() });
    },
    recheck() {
      if (!started && deps.hasHint()) void start();
    },
    async toggle(destId) {
      // 押された時点で cookie があれば、読み込みと確認が終わるのを待ってから進める
      if (!started && deps.hasHint()) void start();
      if (started) await started;
      if (!alive) return "ignored";
      if (!state.userId) return state.ready ? "login" : "ignored";
      if (!state.ready || !client) return "ignored";
      if (pending.has(destId)) return "ignored";
      const userId = state.userId;
      const g = gen;
      pending.add(destId);
      const on = !state.ids.has(destId);
      const flip = (want: boolean) => {
        const ids = new Set(state.ids);
        if (want) ids.add(destId);
        else ids.delete(destId);
        set({ ...state, ids });
      };
      flip(on); // 先に表示を変える
      try {
        const res = await setSaved(client, userId, destId, on);
        // 失敗したら戻す。ただし途中でログアウト・切替があれば、古い結果なので何もしない（一覧は切替時に読み直している）
        if (!res.ok && gen === g && alive) flip(!on);
      } finally {
        pending.delete(destId);
      }
      return "done";
    },
    dispose() {
      alive = false;
      unsub?.();
    },
  };
}
