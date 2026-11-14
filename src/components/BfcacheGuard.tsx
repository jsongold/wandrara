"use client";

// Safari などがページを丸ごと保存して戻したとき（bfcache）は、シートが開いたままなど古い画面になりうるので読み込み直す。
import { useEffect } from "react";

export function BfcacheGuard() {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  return null;
}
