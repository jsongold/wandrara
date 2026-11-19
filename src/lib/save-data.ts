// 通信量を抑える設定（Save-Data）。サーバー・クライアントの両方から使える純粋な部分だけ置く（React の hook は use-save-data.tsx）。
// 抑えると決める入口は 3 つ：リクエストの Save-Data: on ヘッダ（ブラウザのデータセーバー）、navigator.connection.saveData、
// 本人が選んだ cookie（Save-Data に対応しないブラウザ向け。アカウント・ログインの画面のスイッチ）。
export const SAVE_DATA_COOKIE = "savedata";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Save-Data リクエストヘッダは "on" のときだけ有効（仕様）
export function isSaveDataHeader(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "on";
}

// サーバー：ヘッダか cookie のどちらかが有効なら抑える
export function saveDataOfRequest(headerValue: string | null | undefined, cookieValue: string | null | undefined): boolean {
  return isSaveDataHeader(headerValue) || cookieValue === "1";
}

type ConnectionLike = { saveData?: boolean };
export type SaveDataEnv = { connection?: ConnectionLike; cookie: string };

// クライアント：navigator.connection.saveData か cookie（Safari・Firefox は connection を持たない）
export function readSaveData(env: SaveDataEnv): boolean {
  return env.connection?.saveData === true || cookieSaveData(env.cookie);
}

// 本人が選んだ設定（cookie）だけ。ブラウザの設定（connection）とは別に読む（スイッチが自分の分だけを切り替えるため）
export function cookieSaveData(cookie: string): boolean {
  return new RegExp(`(?:^|;\\s*)${SAVE_DATA_COOKIE}=1(?:;|$)`).test(cookie);
}

// 写真の画質。抑えるときは下げる（next.config.ts の images.qualities に両方を載せる。載せない値は近い値に丸められる）
export const IMAGE_QUALITY = 75;
export const SAVE_DATA_IMAGE_QUALITY = 50;
export const imageQuality = (saveData: boolean): number => (saveData ? SAVE_DATA_IMAGE_QUALITY : IMAGE_QUALITY);

export function saveDataCookie(on: boolean): string {
  return on ? `${SAVE_DATA_COOKIE}=1; path=/; max-age=${ONE_YEAR}; samesite=lax` : `${SAVE_DATA_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
