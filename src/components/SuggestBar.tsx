"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { areaSheetLoader, IDLE_AREA_SHEET } from "@/lib/area-sheet-client";
import { messages } from "@/lib/i18n/messages";
import { suggestPlanHref } from "@/lib/suggest";
import type { Locale } from "@/lib/types";
import { BottomSheet, SheetHeader } from "./BottomSheet";
import { Icon } from "./icons";

const GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(16px) saturate(1.2)",
  WebkitBackdropFilter: "blur(16px) saturate(1.2)",
  border: "1px solid rgba(255,255,255,0.14)",
};

// 画面の下に常に出る提案の入力バー。押すと提案の条件のシートが開き、「提案」で提案ページ（/[lang]/plan?t=…）へ移る。
// 条件はエリアの特性（エリア選択シートと同じデータを使い回す）。initial は提案ページで今の条件を選んだ状態にするため
export function SuggestBar({ locale, initial = [] }: { locale: Locale; initial?: string[] }) {
  const m = messages(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(initial);
  const sheet = useSyncExternalStore(areaSheetLoader.subscribe, () => areaSheetLoader.get(locale), () => IDLE_AREA_SHEET);
  const traits = sheet.status === "ready" ? sheet.data.traits.traits : null;
  const load = () => areaSheetLoader.load(locale);

  function onSuggest() {
    setOpen(false);
    router.push(suggestPlanHref(locale, draft));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          load();
          setDraft(initial);
          setOpen(true);
        }}
        // 押す前（触れた・フォーカスした）に取り始める
        onPointerDown={load}
        onFocus={load}
        className="absolute inset-x-3 bottom-[18px] z-[6] flex h-[52px] cursor-pointer items-center gap-2.5 rounded-[18px] px-4 text-left text-[15px] text-white/90"
        style={GLASS}
      >
        <Icon name="sparkle" size={18} className="flex-none" />
        <span className="min-w-0 flex-auto truncate">{m.home.suggestBar}</span>
      </button>

      {open && (
        <BottomSheet label={m.home.suggestSheet} onClose={() => setOpen(false)}>
          <SheetHeader title={m.home.suggestSheet} onClose={() => setOpen(false)} />
          {sheet.status === "error" && (
            <button type="button" onClick={load} className="h-11 cursor-pointer self-start rounded-xl border border-white/40 bg-transparent px-[18px] text-sm text-white">
              {m.home.moreFailed}
            </button>
          )}
          {sheet.status !== "ready" && sheet.status !== "error" && <p role="status" className="m-0 text-[13px] text-white/70">{m.common.loading}</p>}
          {traits && traits.length === 0 && <p className="m-0 text-[13px] text-white/70">{m.home.suggestNone}</p>}
          {traits && traits.length > 0 && (
            // 条件は線だけ・背景なし。選んだものは線と文字を明るく太く
            <div className="flex flex-wrap gap-2">
              {traits.map((t) => {
                const on = draft.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft((d) => (on ? d.filter((x) => x !== t.id) : [...d, t.id]))}
                    className={`flex h-10 cursor-pointer items-center gap-1.5 rounded-full border bg-transparent px-3.5 text-[14px] ${on ? "border-[#f4f1ea] font-bold text-[#f4f1ea]" : "border-white/35 text-white/75"}`}
                  >
                    <Icon name={t.icon} size={16} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={onSuggest}
            disabled={!traits}
            className="h-12 cursor-pointer rounded-[14px] border-0 bg-[#f4f1ea] text-[15px] font-bold text-[#141413] disabled:cursor-default disabled:opacity-50"
          >
            {m.home.suggestApply}
          </button>
        </BottomSheet>
      )}
    </>
  );
}
