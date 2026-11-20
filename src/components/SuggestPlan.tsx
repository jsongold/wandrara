"use client";

import Link from "next/link";
import { messages } from "@/lib/i18n/messages";
import { REACTIONS, type Reaction } from "@/lib/reactions";
import { setReaction, useReactions } from "@/lib/use-reactions";
import { SaveDataHint } from "@/lib/use-save-data";
import type { FeedCard, Locale } from "@/lib/types";
import { Icon } from "./icons";
import { PhotoCarousel } from "./PhotoCarousel";
import { SuggestBar } from "./SuggestBar";

// reason：このカードに当てはまった、選んだこだわりの名前（無ければ空）
export type PlanCard = FeedCard & { reason: string[] };

type Props = { locale: Locale; name: string; picked: string[]; area: string; cards: PlanCard[] };

// 提案ページ：上に条件から付けた名前、真ん中に候補のカードの一覧（背景・枠なし）、下に提案の入力バー（押すと条件のシート）。
// カードには いいね・すごくいい・うーん のリアクションを付けられる
// saveData：サーバーが決めた「通信量を抑える」（写真の画質。Home と同じ）
export function SuggestPlan({ saveData, ...props }: Props & { saveData: boolean }) {
  return (
    <SaveDataHint value={saveData}>
      <SuggestPlanBody {...props} />
    </SaveDataHint>
  );
}

// data-home：詳細シートが開いている間、裏を操作できなくする目印（DetailSheet が inert にする）
function SuggestPlanBody({ locale, name, picked, area, cards }: Props) {
  const m = messages(locale);
  const reactions = useReactions();
  return (
    <div data-home className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-[#0f0f0e] text-white">
      {/* 条件が変わったら作り直して先頭から見せる（同じページへの移動なのでスクロール位置が残るため） */}
      <div key={`${area}|${picked.join(",")}`} className="absolute inset-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <header className="sticky top-0 z-[5] flex items-center gap-1 bg-[#0f0f0e]/90 py-2 pl-1 pr-4 backdrop-blur-md">
          <Link href={`/${locale}`} aria-label={m.common.back} className="flex h-11 w-11 flex-none items-center justify-center text-white">
            <Icon name="back" size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="m-0 truncate font-[family-name:var(--font-phrase)] text-[19px] font-bold leading-snug">{name}</h1>
            <p className="m-0 text-[12px] text-white/60">{m.plan.count(cards.length)}</p>
          </div>
        </header>

        <ul className="m-0 flex list-none flex-col gap-7 px-4 pb-[104px] pt-2">
          {cards.map((card, i) => (
            <li key={card.key} className="flex flex-col gap-2.5">
              <PhotoCarousel photos={card.photos} href={card.href} label={card.title} className="aspect-[4/3] rounded-2xl" counterClassName="right-2.5 top-2.5" priority={i < 2}>
                {(card.photos[0]?.isDemo ?? true) && (
                  <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-md bg-[rgba(15,15,14,0.6)] px-2 py-1 text-[11px] font-semibold">{m.home.photoDemo}</span>
                )}
              </PhotoCarousel>
              <div className="flex items-start gap-2 px-0.5">
                <Link href={card.href} className="flex min-w-0 flex-auto flex-col gap-0.5 text-white no-underline">
                  {card.reason.length > 0 && <span className="text-[12px] font-bold text-[#f4f1ea]">{m.home.reasonMatch(card.reason.join(m.common.listSep))}</span>}
                  <span className="text-[17px] font-bold leading-snug">{card.title}</span>
                  <span className="text-[12px] text-white/60">
                    {card.kindLabel}
                    {m.common.listSep}
                    {card.areaLabel}
                  </span>
                </Link>
                <ReactionButtons locale={locale} title={card.title} value={reactions[card.destId]} onPick={(r) => setReaction(card.destId, r)} />
              </div>
            </li>
          ))}
        </ul>
        {cards.length === 0 && <p className="m-0 px-8 pt-24 text-center text-[17px] font-bold">{m.home.empty}</p>}
      </div>

      <SuggestBar locale={locale} initial={picked} initialArea={area} />
    </div>
  );
}

// いいね（親指）・すごくいい（親指 2 つ）・うーん。背景と枠は付けず、選んだものだけ明るくする
function ReactionButtons({ locale, title, value, onPick }: { locale: Locale; title: string; value: Reaction | undefined; onPick: (r: Reaction) => void }) {
  const m = messages(locale);
  return (
    <div role="group" aria-label={m.plan.reactionsOf(title)} className="-mr-2 flex flex-none">
      {REACTIONS.map((r) => {
        const on = value === r;
        // 選んだものは薄く塗る（線が消えないように）。svg 自身が fill="none" なので svg に付ける
        const fill = on ? "fill-[#f4f1ea]/30" : "";
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            aria-label={m.plan.reactions[r]}
            onClick={() => onPick(r)}
            className={`flex h-11 min-w-11 cursor-pointer items-center justify-center border-0 bg-transparent px-1.5 ${on ? "text-[#f4f1ea]" : "text-white/40"}`}
          >
            {r === "hmm" ? (
              <Icon name="hmm" size={21} className={fill} />
            ) : r === "great" ? (
              <span className="relative flex">
                <Icon name="thumb" size={19} className={`-mr-2 ${fill}`} />
                <Icon name="thumb" size={19} className={fill} />
              </span>
            ) : (
              <Icon name="thumb" size={21} className={fill} />
            )}
          </button>
        );
      })}
    </div>
  );
}
