// トップで最後に見ていた条件（URL）をタブの間だけ覚える。全画面の詳細から戻るときに使う。
// 条件そのものは URL のクエリが正で、ここは戻り先の控えだけ。保存できない環境では fallback（言語つきのトップ）に戻る。

const KEY = "wandrara:last-discover";

export function saveLastDiscoverUrl(url: string): void {
  try {
    sessionStorage.setItem(KEY, url);
  } catch {
    // プライベートモードなどでは保存しない
  }
}

export function readLastDiscoverUrl(fallback: string): string {
  try {
    const url = sessionStorage.getItem(KEY);
    // 自分のサイトのトップ（"/ja" か "/ja?..."）だけを戻り先にする
    if (url && /^\/(ja|en)(\?[^#]*)?$/.test(url)) return url;
  } catch {
    // 読めなければ既定へ
  }
  return fallback;
}
