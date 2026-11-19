"use client";

// 通信量を抑えるか（Save-Data）。サーバーがヘッダ・cookie で決めた結果を hint として最初の描画に使い（水和のあとに先読みが走らないように）、
// 以降はクライアントの値（navigator.connection.saveData・cookie）と hint の「どちらかが有効」で決める。
// hint が null = サーバーが知らない（詳細のような静的なページ）。その間は、サーバーの HTML に「抑えるときは出さないもの」を入れない（useSaveDataSettled）。
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { readSaveData, saveDataCookie } from "./save-data";

const HintContext = createContext<boolean | null>(null);

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
  return useContext(HintContext) === true;
}

export function useSaveData(): boolean {
  const hint = useSaveDataHint();
  return useSyncExternalStore(subscribe, () => hint || readSaveData({ connection: connection(), cookie: document.cookie }), () => hint);
}

const noSubscribe = () => () => {};
// 「抑えるか」が確かか：サーバーが決めた（トップ）か、クライアントで水和が済んだ。
// 確かでない間（サーバーが知らない静的なページのサーバー描画・水和中）は、抑えるときに出さないもの（写真の前後 1 枚）を出さない。出すと水和の前にブラウザが取ってしまう
export function useSaveDataSettled(): boolean {
  const known = useContext(HintContext) !== null;
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  return known || hydrated;
}

// 本人が選ぶ設定（cookie）。サーバーの描画（先読み・hint）にも効かせるため、読み込み直して反映する
export function setSaveDataPreference(on: boolean): void {
  document.cookie = saveDataCookie(on);
  location.reload();
}
