"use client";

// 画面全体で共有する保存状態。ログイン状態と保存の読み書きはブラウザの client で行う
// （トップと詳細をサーバーで動的にしないため。RLS で自分の行だけ読み書きできる）
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

  useEffect(() => {
    const supabase = createClient();
    let current: string | null | undefined;
    let alive = true;
    function apply(id: string | null) {
      if (id === current) return;
      current = id;
      setUserId(id);
      if (!id) {
        setIds(new Set());
        setReady(true);
        return;
      }
      setReady(false);
      listSavedIds(supabase)
        .then((s) => {
          if (alive && current === id) setIds(s);
        })
        .catch(() => {
          if (alive && current === id) setIds(new Set());
        })
        .finally(() => {
          if (alive && current === id) setReady(true);
        });
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
      if (!userId) return;
      const on = !ids.has(destId);
      const flip = (want: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (want) next.add(destId);
          else next.delete(destId);
          return next;
        });
      flip(on); // 先に表示を変える
      const res = await setSaved(createClient(), userId, destId, on);
      if (!res.ok) flip(!on); // 失敗したら戻す
    },
    [userId, ids],
  );

  const value = useMemo(() => ({ signedIn: !!userId, ready, isSaved, toggle }), [userId, ready, isSaved, toggle]);
  return <SavesContext.Provider value={value}>{children}</SavesContext.Provider>;
}

export function useSaves(): Saves {
  return useContext(SavesContext);
}
