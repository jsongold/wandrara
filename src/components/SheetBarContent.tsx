"use client";

// シートの上端のバーに、名前と保存ボタンを差し込む。名前はバーに背景が付いたとき（写真を過ぎたとき）だけ見せる。
import { createPortal } from "react-dom";
import { useSheetBar } from "./sheet-context";
import { SaveButton } from "./SaveButton";
import { SHEET_GLASS } from "./DetailSheet";

export function SheetBarContent({ title, destId }: { title: string; destId: string }) {
  const slot = useSheetBar();
  if (!slot) return null;
  return createPortal(
    <>
      <p className="m-0 min-w-0 flex-1 truncate text-[15px] font-bold text-[#141413] opacity-0 transition-opacity duration-200 group-data-[solid=true]:opacity-100" aria-hidden="true">
        {title}
      </p>
      <SaveButton destId={destId} variant="detail" style={SHEET_GLASS} />
    </>,
    slot,
  );
}
