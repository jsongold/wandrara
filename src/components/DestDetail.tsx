import type { CSSProperties } from "react";
import type { DestDetailView } from "@/lib/detail";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { AccommodationSections } from "./accommodation/AccommodationSections";
import { StayStrip } from "./accommodation/StayStrip";
import { BackButton } from "./BackButton";
import { FactRows } from "./FactRows";
import { PhotoCarousel } from "./PhotoCarousel";
import { SaveButton } from "./SaveButton";

const GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

// 地図の枠（準備中）。className で高さと角を変える
function MapPlaceholder({ label, ariaLabel, className }: { label: string; ariaLabel: string; className: string }) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`flex items-center justify-center border border-[#d0d5cf] bg-[#dfe3de] text-xs text-[#4a5048] ${className}`}
    >
      {label}
    </div>
  );
}

// variant: page=全画面（共有リンク・再読み込み）、sheet=トップの上に重ねるシート
// 宿の details があれば、設備・条件とアクセスの代わりに宿のトピックを並べる（地図はアクセスのカードの中）
export function DestDetail({ dest, variant, locale }: { dest: DestDetailView; variant: "page" | "sheet"; locale: Locale }) {
  const m = messages(locale);
  const hero = dest.photos[0] ?? null;
  const acc = dest.accommodation;
  return (
    <main className={`mx-auto w-full max-w-[480px] bg-[#f7f6f2] text-[#141413] ${variant === "page" ? "min-h-[100dvh]" : ""}`}>
      {/* 写真は横にスワイプで切り替える */}
      <PhotoCarousel photos={dest.photos} label={dest.title} className="h-[420px]">
        <div className={`absolute left-4 ${variant === "sheet" ? "top-6" : "top-3.5"}`}>
          <BackButton variant={variant} style={GLASS} />
        </div>
        <div className={`absolute right-4 ${variant === "sheet" ? "top-6" : "top-3.5"}`}>
          <SaveButton destId={dest.id} variant="detail" style={GLASS} />
        </div>
        {(hero?.isDemo ?? true) && (
          <span className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-[rgba(15,15,14,0.6)] px-2 py-1 text-[11px] font-semibold text-white">{m.home.photoDemo}</span>
        )}
      </PhotoCarousel>

      <div className="flex flex-col gap-7 px-5 pb-10 pt-5">
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-[#e8e5dc] px-2 py-[3px] text-[11px] font-semibold text-[#3d3b35]">{dest.kindLabel}</span>
            {dest.isDemo && <span className="rounded-md bg-[#e8e5dc] px-2 py-[3px] text-[11px] font-semibold text-[#3d3b35]">{m.detail.demoData}</span>}
          </div>
          <h1 className="m-0 text-2xl font-bold leading-[1.35]">{dest.title}</h1>
          <p className="m-0 text-sm text-[#55524a]">{dest.areaLabel}</p>
          {dest.summary && <p className="m-0 mt-1 text-sm leading-[1.8] text-[#2b2a26]">{dest.summary}</p>}
          {acc && (
            <div className="mt-1 flex">
              <StayStrip checkIn={acc.stay.checkIn} checkOut={acc.stay.checkOut} />
            </div>
          )}
        </section>

        {acc ? (
          <AccommodationSections
            view={acc}
            map={<MapPlaceholder label={m.detail.map} ariaLabel={m.detail.mapSoon} className="h-[150px] rounded-[10px]" />}
            note={m.detail.factsNote}
          />
        ) : (
          <>
            {dest.facts.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="m-0 text-lg font-bold">{m.detail.facts}</h2>
                </div>
                <FactRows facts={dest.facts} />
                <p className="m-0 text-xs leading-[1.7] text-[#55524a]">{m.detail.factsNote}</p>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="m-0 text-lg font-bold">{m.detail.access}</h2>
              <MapPlaceholder label={m.detail.map} ariaLabel={m.detail.mapSoon} className="h-[180px] rounded-2xl" />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
