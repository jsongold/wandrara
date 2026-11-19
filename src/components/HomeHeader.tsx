"use client";

// home-header：トップのヘッダー。左にタイトルと今のエリア、右にアカウント（ユーザーのアイコン）
// 一覧をスクロールしたら畳む（collapsed）：タイトルは上へ抜けて見えなくなり、エリアの名前が左へ寄る。いちばん上に戻ると元に戻る
// area はエリアの名前の場所に置く物（エリアの一言があればそれを開くボタン、無ければ名前だけ）
import type { CSSProperties, ReactNode } from "react";
import { AccountButton } from "./AccountButton";

const MOTION = "320ms cubic-bezier(0.32, 0.72, 0, 1)";

type Props = {
  locale: Parameters<typeof AccountButton>[0]["locale"];
  // ログインの後に戻る先
  next: string;
  // タイトルの下の小さな文字（並び順など）
  subtitle: string;
  iconStyle: CSSProperties;
  collapsed: boolean;
  area: ReactNode;
};

export function HomeHeader({ locale, next, subtitle, iconStyle, collapsed, area }: Props) {
  return (
    <header data-collapsed={collapsed} className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-auto items-center">
        {/* タイトルの幅（右の余白 12px を含む）は --title-w。畳むときはこの幅を 0 にして、エリアの名前を左へ寄せる。狭い画面（380px 未満）では詰める */}
        <div
          aria-hidden={collapsed || undefined}
          className="min-w-0 flex-[0_1_auto] overflow-hidden [--title-w:176px] motion-reduce:!transition-none max-[379px]:[--title-w:150px]"
          style={{ width: collapsed ? 0 : "var(--title-w)", transition: `width ${MOTION}` }}
        >
          <div
            className="flex flex-col gap-0.5 motion-reduce:!transition-none"
            style={{ width: "calc(var(--title-w) - 12px)", transform: collapsed ? "translateY(-160%)" : "none", opacity: collapsed ? 0 : 1, transition: `transform ${MOTION}, opacity ${MOTION}` }}
          >
            <span className="text-[15px] font-semibold tracking-[0.24em] [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">WANDRARA</span>
            <span className="truncate text-[11px] text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">{subtitle}</span>
          </div>
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
