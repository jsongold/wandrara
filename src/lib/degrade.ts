// 画面の主役ではない取得が失敗したとき、ページ全体を落とさず代わりの値で続ける（MS4 #105）。
// 主役（フィードの最初のページ）にはこれを使わない：それが無いと出せるものが無いので error.tsx に任せる。
// Next.js の内部の例外（notFound・redirect・動的な読み取り）は止めずに投げ直す。
import { unstable_rethrow } from "next/navigation";

export async function orFallback<T>(work: Promise<T>, fallback: T, what: string): Promise<T> {
  try {
    return await work;
  } catch (e) {
    unstable_rethrow(e);
    console.error(`${what}の取得に失敗。代わりの値で表示を続けます`, e);
    return fallback;
  }
}
