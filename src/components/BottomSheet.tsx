"use client";

import type { ReactNode } from "react";
import { useMessages } from "@/lib/i18n/use-locale";
import { Icon } from "./icons";

// 画面の下から出るシート。外側（透明なボタン）を押すと閉じる
export function BottomSheet({
  label,
  onClose,
  children,
  height,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  height?: string;
}) {
  const m = useMessages();
  return (
    <>
      <button type="button" aria-label={m.home.closeSheet(label)} onClick={onClose} className="absolute inset-0 z-[19] cursor-pointer border-0 bg-transparent" />
      <section
        role="dialog"
        aria-label={label}
        style={height ? { height } : undefined}
        className="absolute inset-x-0 bottom-0 z-20 flex max-h-[700px] flex-col gap-5 overflow-y-auto rounded-t-3xl bg-[#1b1b19] px-5 pb-7 pt-5"
      >
        {children}
      </section>
    </>
  );
}

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const m = useMessages();
  return (
    <div className="flex items-center justify-between">
      <h2 className="m-0 text-lg font-bold">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={m.common.close}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-white"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

