"use client";

// 通信量を抑えるか（Save-Data）。サーバーがヘッダ・cookie で決めた結果を hint として最初の描画に使い（水和のあとに先読みが走らないように）、
// 以降はクライアントの値（navigator.connection.saveData・cookie）と hint の「どちらかが有効」で決める。
// サーバーの HTML に「抑えるときは出さないもの」（写真の前後 1 枚）は入れない（useHydrated）。入れるとブラウザが水和の前に取ってしまう。
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { cookieSaveData, readSaveData, saveDataCookie } from "./save-data";

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
  const hint = useSaveDataHint();
  return useSyncExternalStore(subscribe, () => hint || readSaveData({ connection: connection(), cookie: document.cookie }), () => hint);
}

const noSubscribe = () => () => {};
// クライアントで水和が済んだか（サーバーの描画・水和中は false）。「抑えるか」はクライアントの値（connection・cookie）が決め手で、水和の前は確かでない。
// 確かになるまで、抑えるときに出さないもの（写真の前後 1 枚）を出さない
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

// スイッチの状態。on = 抑えている（本人の cookie か、ブラウザの設定）、locked = ブラウザの設定で抑えている（スイッチでは外せない）
export function useSaveDataSwitch(): { on: boolean; locked: boolean } {
  const cookie = useSyncExternalStore(noSubscribe, () => cookieSaveData(document.cookie), () => false);
  const locked = useSyncExternalStore(subscribe, () => connection()?.saveData === true, () => false);
  return { on: cookie || locked, locked };
}

// 本人が選ぶ設定（cookie）。サーバーの描画（先読み・hint）にも効かせるため、読み込み直して反映する
export function setSaveDataPreference(on: boolean): void {
  document.cookie = saveDataCookie(on);
  location.reload();
}
