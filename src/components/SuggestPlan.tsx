"use client";

import Link from "next/link";
import { messages } from "@/lib/i18n/messages";
import type { SuggestReason } from "@/lib/suggest";
import type { FeedCard, Locale } from "@/lib/types";
import { Icon } from "./icons";
import { PhotoCarousel } from "./PhotoCarousel";
import { SaveButton } from "./SaveButton";
import { SuggestBar } from "./SuggestBar";

export type PlanCard = FeedCard & { reason: SuggestReason | null };

// 提案ページ：提案の条件から作った並びを、1 画面に 1 枚ずつ全画面で見せる。下には提案の入力バー（条件を変えて作り直す）
export function SuggestPlan({ locale, picked, cards }: { locale: Locale; picked: string[]; cards: PlanCard[] }) {
  const m = messages(locale);
  return (
    <div className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-[#0f0f0e] text-white">
      <div data-feed className="absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((card, i) => (
          <article key={card.key} className="h-full snap-start snap-always">
            <PhotoCarousel photos={card.photos} href={card.href} label={card.title} className="h-full text-white" counterClassName="right-4 top-[76px]" priority={i === 0}>
              {(card.photos[0]?.isDemo ?? true) && (
                <span className="pointer-events-none absolute left-4 top-[76px] rounded-md bg-[rgba(15,15,14,0.6)] px-2 py-1 text-[11px] font-semibold tracking-[0.06em]">{m.home.photoDemo}</span>
              )}
              <SaveButton destId={card.destId} variant="card" className="absolute right-3 top-[104px]" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] bg-gradient-to-b from-transparent to-black/70" />
              <span className="pointer-events-none absolute inset-x-4 bottom-[96px] flex flex-col gap-1.5">
                {card.reason && (
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#f4f1ea]">
                    <Icon name={card.reason.traits[0].icon} size={15} />
                    {card.reason.kind === "match"
                      ? m.home.reasonMatch(card.reason.traits.map((t) => t.label).join(m.common.listSep))
                      : m.home.reasonTrait(card.reason.traits[0].label)}
                  </span>
                )}
                <span className="self-start rounded-md border border-white/50 px-2 py-[3px] text-[11px] font-semibold">{card.kindLabel}</span>
                <span className="text-2xl font-bold leading-[1.3]">{card.title}</span>
                <span className="text-[13px] text-white/90">{card.areaLabel}</span>
              </span>
            </PhotoCarousel>
          </article>
        ))}
        {cards.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="m-0 text-[17px] font-bold">{m.home.empty}</p>
          </div>
        )}
      </div>

      {/* 上：Home へ戻る */}
      <Link
        href={`/${locale}`}
        aria-label={m.common.back}
        className="absolute left-3 top-3 z-[6] flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(18,18,16,0.6)] text-white"
      >
        <Icon name="back" size={20} />
      </Link>

      <SuggestBar locale={locale} initial={picked} />
    </div>
  );
}
