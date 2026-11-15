"use client";

// 詳細の戻るボタン。シートなら閉じる（下へ滑らせてから戻る）。全画面なら、最後に見ていた条件つきのトップへ戻る。
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { switchLocale } from "@/lib/i18n/locale";
import { useLocale, useMessages } from "@/lib/i18n/use-locale";
import { readLastDiscoverUrl } from "@/lib/last-discover";
import { Icon } from "./icons";
import { useSheetClose } from "./sheet-context";

export function BackButton({ variant, style }: { variant: "page" | "sheet"; style: CSSProperties }) {
  const router = useRouter();
  const locale = useLocale();
  const m = useMessages();
  const closeSheet = useSheetClose();
  function onClick() {
    if (variant === "page") router.push(switchLocale(readLastDiscoverUrl(`/${locale}`), locale));
    else if (closeSheet) closeSheet();
    else router.back();
  }
  return (
    <button type="button" onClick={onClick} aria-label={variant === "sheet" ? m.common.close : m.common.back} className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={style}>
      <Icon name={variant === "sheet" ? "close" : "back"} />
    </button>
  );
}
