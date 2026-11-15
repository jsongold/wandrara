"use client";

// 詳細の戻るボタン。シートなら閉じる（下へ滑らせてから戻る）。全画面なら、最後に見ていた条件つきのトップへ戻る。
import { useParams, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { DEFAULT_LOCALE, isLocale, switchLocale } from "@/lib/i18n/locale";
import { readLastDiscoverUrl } from "@/lib/last-discover";
import { Icon } from "./icons";
import { useSheetClose } from "./sheet-context";

export function BackButton({ variant, style }: { variant: "page" | "sheet"; style: CSSProperties }) {
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const closeSheet = useSheetClose();
  function onClick() {
    if (variant === "page") router.push(switchLocale(readLastDiscoverUrl(`/${locale}`), locale));
    else if (closeSheet) closeSheet();
    else router.back();
  }
  return (
    <button type="button" onClick={onClick} aria-label={variant === "sheet" ? "閉じる" : "戻る"} className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={style}>
      <Icon name={variant === "sheet" ? "close" : "back"} />
    </button>
  );
}
