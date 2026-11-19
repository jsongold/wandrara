"use client";

// 通信量を抑える設定のスイッチ。Save-Data に対応しないブラウザでも、本人が選べる（cookie に残す）。
// 抑えるあいだは、先読み・写真の先読み・地図の自動読み込みを止める（地図は押したら読む）
import type { CSSProperties } from "react";
import { messages } from "@/lib/i18n/messages";
import { setSaveDataPreference, useSaveDataSwitch } from "@/lib/use-save-data";
import type { Locale } from "@/lib/types";

export function SaveDataSwitch({ locale, className, style }: { locale: Locale; className?: string; style?: CSSProperties }) {
  const { on, locked } = useSaveDataSwitch();
  const m = messages(locale).account;
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={m.saveData} data-testid="save-data-switch" disabled={locked} title={locked ? m.saveDataLocked : undefined} onClick={() => setSaveDataPreference(!on)} className={className} style={style}>
      {on ? m.saveDataOn : m.saveDataOff}
    </button>
  );
}
