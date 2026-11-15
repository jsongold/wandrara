"use client";

// 保存（お気に入り）のハート。保存済みは塗り、未保存は線だけ。
// 写真のリンクの上に重ねるため、クリックはリンクへ伝えない。未ログインならログインへ送る（ログイン後の自動保存はしない）
import { useRouter } from "next/navigation";
import type { CSSProperties, MouseEvent } from "react";
import { withLocale } from "@/lib/i18n/locale";
import { useLocale, useMessages } from "@/lib/i18n/use-locale";
import { useSaves } from "./saves-context";

// icons.tsx の heart と同じ形
const HEART = "M12 20s-7-4.5-9-9a4.5 4.5 0 0 1 8-3.5L12 9l1-1.5A4.5 4.5 0 0 1 21 11c-2 4.5-9 9-9 9z";

const VARIANT: Record<"card" | "detail", string> = {
  // 写真の上：白い線。写真が明るくても見えるよう影を付ける
  card: "text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.45))]",
  // 詳細：戻るボタンと同じ見た目は style で外から渡す
  detail: "rounded-full text-white",
};

export function SaveButton({
  destId,
  variant,
  className,
  style,
}: {
  destId: string;
  variant: "card" | "detail";
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const locale = useLocale();
  const m = useMessages();
  const { signedIn, ready, isSaved, toggle } = useSaves();
  const saved = isSaved(destId);

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!ready) return;
    if (!signedIn) {
      const next = encodeURIComponent(location.pathname + location.search);
      router.push(withLocale(locale, `/login?next=${next}`));
      return;
    }
    void toggle(destId);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? m.saves.unsave : m.saves.save}
      data-testid="save-button"
      className={`flex h-11 w-11 items-center justify-center ${VARIANT[variant]} ${className ?? ""}`}
      style={style}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={HEART} />
      </svg>
    </button>
  );
}
