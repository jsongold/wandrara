"use client";

// 詳細の戻るボタン。シートなら閉じる（router.back）。全画面なら、最後に見ていた条件つきのトップへ戻る。
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { readLastDiscoverUrl } from "@/lib/last-discover";
import { Icon } from "./icons";

export function BackButton({ variant, style }: { variant: "page" | "sheet"; style: CSSProperties }) {
  const router = useRouter();
  function onClick() {
    if (variant === "sheet") router.back();
    else router.push(readLastDiscoverUrl());
  }
  return (
    <button type="button" onClick={onClick} aria-label={variant === "sheet" ? "閉じる" : "戻る"} className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={style}>
      <Icon name={variant === "sheet" ? "close" : "back"} />
    </button>
  );
}
