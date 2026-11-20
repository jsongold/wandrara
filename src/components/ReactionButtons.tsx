"use client";

import { messages } from "@/lib/i18n/messages";
import { REACTIONS, type Reaction } from "@/lib/reactions";
import type { Locale } from "@/lib/types";
import { Icon } from "./icons";

// いいね（親指）・すごくいい（親指 2 つ）・うーん。背景と枠は付けず、選んだものだけ明るくして薄く塗る
export function ReactionButtons({ locale, title, value, onPick, className = "" }: { locale: Locale; title: string; value: Reaction | undefined; onPick: (r: Reaction) => void; className?: string }) {
  const m = messages(locale);
  return (
    <div role="group" aria-label={m.plan.reactionsOf(title)} className={`flex ${className}`}>
      {REACTIONS.map((r) => {
        const on = value === r;
        // svg 自身が fill="none" なので、塗りは svg に付ける
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
