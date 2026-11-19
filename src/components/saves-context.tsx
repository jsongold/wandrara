"use client";

// 画面全体で共有する保存状態。ログイン状態と保存の読み書きはブラウザの client で行う
// （トップと詳細をサーバーで動的にしないため。RLS で自分の行だけ読み書きできる）
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createSavesSession, type SavesSession, type SavesState, type ToggleResult } from "@/lib/saves-session";
import { hasAuthCookie } from "@/lib/supabase/auth-cookie";

type Saves = {
  signedIn: boolean;
  /** ログイン状態（と、ログイン中なら保存の一覧）を読み終えた */
  ready: boolean;
  isSaved: (destId: string) => boolean;
  /** 押したときに必要なら Supabase を読み込んで確認してから保存する。login ならログインへ送る */
  toggle: (destId: string) => Promise<ToggleResult>;
};

const SavesContext = createContext<Saves>({
  signedIn: false,
  ready: false,
  isSaved: () => false,
  toggle: async () => "ignored",
});

// Supabase の JS は動的 import。未ログイン（cookie 無し）の人には読み込まない
const loadClient = () => import("@/lib/supabase/client").then((m) => m.createClient());

export function SavesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SavesState>({ userId: null, ready: false, ids: new Set() });
  const sessionRef = useRef<SavesSession | null>(null);

  useEffect(() => {
    const session = createSavesSession({
      hasHint: () => hasAuthCookie(document.cookie),
      loadClient,
      onChange: setState,
    });
    sessionRef.current = session;
    session.init();
    // 別タブでログインした cookie に気付く（ログアウトは読み込み済みの client が BroadcastChannel で受ける）
    const recheck = () => session.recheck();
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  const isSaved = useCallback((destId: string) => state.ids.has(destId), [state.ids]);
  const toggle = useCallback(async (destId: string): Promise<ToggleResult> => sessionRef.current?.toggle(destId) ?? "ignored", []);

  const value = useMemo(() => ({ signedIn: !!state.userId, ready: state.ready, isSaved, toggle }), [state.userId, state.ready, isSaved, toggle]);
  return <SavesContext.Provider value={value}>{children}</SavesContext.Provider>;
}

export function useSaves(): Saves {
  return useContext(SavesContext);
}
