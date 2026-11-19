"use client";

// 通信量を抑えるか（Save-Data）。サーバーがヘッダ・cookie で決めた結果を hint として最初の描画に使い（水和のあとに先読みが走らないように）、
// 以降はクライアントの値（navigator.connection.saveData・cookie）と hint の「どちらかが有効」で決める。
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { readSaveData, saveDataCookie } from "./save-data";

const HintContext = createContext(false);

export function SaveDataHint({ value, children }: { value: boolean; children: ReactNode }) {
  return <HintContext.Provider value={value}>{children}</HintContext.Provider>;
}

type Conn = { saveData?: boolean; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void };
const connection = (): Conn | undefined => (navigator as Navigator & { connection?: Conn }).connection;

// 回線のデータセーバーを途中で切り替えたとき（change）に追従する
function subscribe(l: () => void): () => void {
  const c = connection();
  c?.addEventListener?.("change", l);
  return () => c?.removeEventListener?.("change", l);
}

// サーバーが決めた値だけ（画質のように、サーバーが出す HTML の写真と同じ URL にしたいもの用。水和のあとに URL が変わって二重に取らない）
export function useSaveDataHint(): boolean {
  return useContext(HintContext);
}

export function useSaveData(): boolean {
  const hint = useContext(HintContext);
  return useSyncExternalStore(subscribe, () => hint || readSaveData({ connection: connection(), cookie: document.cookie }), () => hint);
}

// 本人が選ぶ設定（cookie）。サーバーの描画（先読み・hint）にも効かせるため、読み込み直して反映する
export function setSaveDataPreference(on: boolean): void {
  document.cookie = saveDataCookie(on);
  location.reload();
}
