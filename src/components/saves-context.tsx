"use client";

// 画面全体で共有する保存状態。ログイン状態と保存の読み書きはブラウザの client で行う
// （トップと詳細をサーバーで動的にしないため。RLS で自分の行だけ読み書きできる）
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listSavedIds, setSaved } from "@/lib/saves";
import { createClient } from "@/lib/supabase/client";

type Saves = {
  signedIn: boolean;
  /** ログイン状態（と、ログイン中なら保存の一覧）を読み終えた */
  ready: boolean;
  isSaved: (destId: string) => boolean;
  toggle: (destId: string) => Promise<void>;
};

const SavesContext = createContext<Saves>({
  signedIn: false,
  ready: false,
  isSaved: () => false,
  toggle: async () => {},
});

export function SavesProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  // 認証の世代。ログイン・ログアウト・切替のたびに進める。通信の結果が返ったとき世代が変わっていれば、古い結果として捨てる
  const genRef = useRef(0);
  // 通信中の dest。同じ dest の操作は終わるまで受け付けない（保存と解除が逆順に届くのを防ぐ）
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    let current: string | null | undefined;
    let alive = true;
    function apply(id: string | null) {
      if (id === current) return;
      current = id;
      genRef.current += 1;
      setUserId(id);
      setIds(new Set());
      if (!id) {
        setReady(true);
        return;
      }
      setReady(false);
      // 失敗したら ready にしない（保存済みが未保存に見えるのを防ぐ）。ボタンは押しても何もしない
      listSavedIds(supabase)
        .then((s) => {
          if (!alive || current !== id) return;
          setIds(s);
          setReady(true);
        })
        .catch(() => {});
    }
    supabase.auth.getUser().then(({ data }) => alive && apply(data.user?.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => apply(session?.user?.id ?? null));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const isSaved = useCallback((destId: string) => ids.has(destId), [ids]);

  const toggle = useCallback(
    async (destId: string) => {
      if (!userId || !ready) return;
      const gen = genRef.current;
      const pending = pendingRef.current;
      if (pending.has(destId)) return;
      pending.add(destId);
      const on = !ids.has(destId);
      const flip = (want: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (want) next.add(destId);
          else next.delete(destId);
          return next;
        });
      flip(on); // 先に表示を変える
      try {
        const res = await setSaved(createClient(), userId, destId, on);
        // 失敗したら戻す。ただし途中でログアウト・切替があれば、古い結果なので何もしない（一覧は切替時に読み直している）
        if (!res.ok && genRef.current === gen) flip(!on);
      } finally {
        pending.delete(destId);
      }
    },
    [userId, ready, ids],
  );

  const value = useMemo(() => ({ signedIn: !!userId, ready, isSaved, toggle }), [userId, ready, isSaved, toggle]);
  return <SavesContext.Provider value={value}>{children}</SavesContext.Provider>;
}

export function useSaves(): Saves {
  return useContext(SavesContext);
}
