"use client";

// use-scrolled-away：要素がいちばん上からスクロールされているか。トップのヘッダーのタイトルを畳むのに使う
import { useEffect, useState, type RefObject } from "react";

// これより下へスクロールしたら「離れた」（少しの揺れで切り替わらないように）
const AWAY_PX = 8;

export function useScrolledAway(ref: RefObject<HTMLElement | null>): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setAway(el.scrollTop > AWAY_PX);
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, [ref]);
  return away;
}
