"use client";

// シートの中から、シートを閉じる（下へ滑らせてから戻る）ための入り口。シートの外では null。
import { createContext, useContext } from "react";

export const SheetCloseContext = createContext<(() => void) | null>(null);

export function useSheetClose(): (() => void) | null {
  return useContext(SheetCloseContext);
}
