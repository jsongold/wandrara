"use client";

// ログアウトのボタンと確認。確認は画面内の状態で出し入れする（URL を変えない）。
// シートの「閉じる」は履歴を 1 つ戻るので、確認で履歴を積むと閉じたときに /account に戻ってシートが残るため
import { useState } from "react";
import { signOut } from "@/app/[lang]/account/actions";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";

export function LogoutButton({ lang }: { lang: Locale }) {
  const [confirming, setConfirming] = useState(false);
  const m = messages(lang).account;
  const c = messages(lang).common;
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-auto flex h-[52px] cursor-pointer items-center justify-center rounded-[26px] border border-[#d6d3cb] bg-white text-[15px] font-medium text-[#a1361f]"
      >
        {m.logout}
      </button>
      {confirming && (
        <>
          <button type="button" aria-label={c.close} onClick={() => setConfirming(false)} className="absolute inset-0 z-10 cursor-pointer border-0 bg-black/45" />
          <section
            role="dialog"
            aria-labelledby="logout-title"
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-[18px] rounded-t-3xl bg-white px-6 pb-7 pt-2.5"
          >
            <div className="flex justify-center">
              <span className="h-[5px] w-10 rounded-[3px] bg-[#d6d3cb]" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 id="logout-title" className="m-0 text-lg font-bold leading-snug">{m.logoutConfirm}</h2>
              <p className="m-0 text-[13px] leading-[1.7] text-[#55524a]">{m.logoutNote}</p>
            </div>
            <form action={signOut} className="flex">
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className="h-[52px] flex-1 cursor-pointer rounded-[26px] border-0 bg-[#a1361f] text-[15px] font-medium text-white">
                {m.logout}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex h-[52px] cursor-pointer items-center justify-center rounded-[26px] border border-[#d6d3cb] bg-transparent text-[15px] font-medium text-[#171717]"
            >
              {m.cancel}
            </button>
          </section>
        </>
      )}
    </>
  );
}
