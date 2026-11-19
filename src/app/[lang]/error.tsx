"use client";

// ページ全体の失敗（フィードの最初のページが取れない・描画で例外）。同じ segment の layout（html・言語・保存状態）は対象外で、その内側（ページと @sheet）を受ける。
// フィードの続き・エリアの一覧・地図・カテゴリ・エリア名は、それぞれ局所の失敗にして画面を落とさない（ここには来ない）。
import { useEffect } from "react";
import { useMessages } from "@/lib/i18n/use-locale";

export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  const m = useMessages();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main role="alert" className="flex h-[100dvh] flex-col items-center justify-center gap-3.5 bg-[#0f0f0e] px-8 text-center text-white">
      <span className="text-[15px] font-semibold tracking-[0.24em]">WANDRARA</span>
      <p className="m-0 text-[17px] font-bold">{m.common.pageFailed}</p>
      <p className="m-0 text-[13px] leading-[1.7] text-white/80">{m.common.pageFailedHint}</p>
      <button type="button" onClick={() => retry()} className="mt-2 h-11 cursor-pointer rounded-xl border border-white/40 bg-transparent px-[18px] text-sm text-white">
        {m.common.retry}
      </button>
    </main>
  );
}
