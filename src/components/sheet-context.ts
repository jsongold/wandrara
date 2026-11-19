"use client";

// シートの中から、シートを閉じる（下へ滑らせてから戻る）ための入り口。シートの外では null。
import { createContext, useContext } from "react";

export const SheetCloseContext = createContext<(() => void) | null>(null);

export function useSheetClose(): (() => void) | null {
  return useContext(SheetCloseContext);
}

// シートの上端のバーの、閉じるボタンの右側の置き場（名前と保存を差し込む）。シートの外では null。
export const SheetBarContext = createContext<HTMLElement | null>(null);

export function useSheetBar(): HTMLElement | null {
  return useContext(SheetBarContext);
}
