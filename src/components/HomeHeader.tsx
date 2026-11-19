"use client";

// home-header：トップのヘッダー。左にタイトルと今のエリア、右にアカウント（ユーザーのアイコン）
// area はエリアの名前の場所に置く物（エリアの一言があればそれを開くボタン、無ければ名前だけ）
import type { CSSProperties, ReactNode } from "react";
import { AccountButton } from "./AccountButton";

type Props = {
  locale: Parameters<typeof AccountButton>[0]["locale"];
  // ログインの後に戻る先
  next: string;
  // タイトルの下の小さな文字（並び順など）
  subtitle: string;
  iconStyle: CSSProperties;
  area: ReactNode;
};

export function HomeHeader({ locale, next, subtitle, iconStyle, area }: Props) {
  return (
    <header className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-auto items-center gap-3">
        <div className="flex min-w-0 max-w-[50%] flex-none flex-col gap-0.5">
          <span className="text-[15px] font-semibold tracking-[0.24em] [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">WANDRARA</span>
          <span className="truncate text-[11px] text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">{subtitle}</span>
        </div>
        {area}
      </div>
      {/* 言語の切り替えはアカウント／ログインの画面に置く */}
      <AccountButton
        locale={locale}
        next={next}
        className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full text-white"
        style={iconStyle}
      />
    </header>
  );
}
