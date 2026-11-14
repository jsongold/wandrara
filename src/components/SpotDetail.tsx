import type { CSSProperties } from "react";
import type { Photo, SpotDetailView } from "@/lib/types";
import { BackButton } from "./BackButton";
import { FactRows } from "./FactRows";

const GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

// 写真があれば写真、無ければデモ用の色面（空と地面）
function photoStyle(photo: Photo | null): CSSProperties {
  if (photo?.url && !photo.isDemo) {
    return { backgroundImage: `url(${photo.url})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const sky = photo?.placeholderSky ?? "#8f9692";
  const land = photo?.placeholderLand ?? "#2e322f";
  return { background: `linear-gradient(180deg, ${sky} 0%, ${sky} 56%, ${land} 56%, ${land} 100%)` };
}

// variant: page=全画面（共有リンク・再読み込み）、sheet=トップの上に重ねるシート
export function SpotDetail({ spot, variant }: { spot: SpotDetailView; variant: "page" | "sheet" }) {
  const hero = spot.photos[0] ?? null;
  return (
    <main className={`mx-auto w-full max-w-[480px] bg-[#f7f6f2] text-[#141413] ${variant === "page" ? "min-h-[100dvh]" : ""}`}>
      <div className="relative h-[420px]" style={photoStyle(hero)}>
        <div className={`absolute inset-x-4 flex justify-between ${variant === "sheet" ? "top-6" : "top-3.5"}`}>
          <BackButton variant={variant} style={GLASS} />
        </div>
        {(hero?.isDemo ?? true) && (
          <span className="absolute bottom-4 left-4 rounded-md bg-[rgba(15,15,14,0.6)] px-2 py-1 text-[11px] font-semibold text-white">写真（デモ）</span>
        )}
        {spot.photos.length > 1 && (
          <span className="absolute bottom-4 right-4 rounded-xl bg-[rgba(15,15,14,0.6)] px-2.5 py-1 text-xs font-semibold text-white">1 / {spot.photos.length}</span>
        )}
      </div>

      <div className="flex flex-col gap-7 px-5 pb-10 pt-5">
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-[#e8e5dc] px-2 py-[3px] text-[11px] font-semibold text-[#3d3b35]">{spot.kindLabel}</span>
            {spot.isDemo && <span className="rounded-md bg-[#e8e5dc] px-2 py-[3px] text-[11px] font-semibold text-[#3d3b35]">デモデータ</span>}
          </div>
          <h1 className="m-0 text-2xl font-bold leading-[1.35]">{spot.title}</h1>
          <p className="m-0 text-sm text-[#55524a]">{spot.areaLabel}</p>
          {spot.summary && <p className="m-0 mt-1 text-sm leading-[1.8] text-[#2b2a26]">{spot.summary}</p>}
        </section>

        <section className="flex flex-col gap-2.5 rounded-2xl border border-[#e2dfd6] bg-white p-4">
          <h2 className="m-0 text-[13px] font-semibold text-[#55524a]">料金</h2>
          <p className="m-0 text-sm text-[#55524a]">料金情報なし（未確認）</p>
        </section>

        {spot.facts.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-lg font-bold">設備・条件</h2>
              <span className="text-[11px] text-[#55524a]">出典と確認日つき</span>
            </div>
            <FactRows facts={spot.facts} />
            <p className="m-0 text-xs leading-[1.7] text-[#55524a]">「不明」は情報が無いことを示し、「無い」という意味ではありません。</p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-lg font-bold">アクセス</h2>
          <div
            role="img"
            aria-label="地図（準備中）"
            className="flex h-[180px] items-center justify-center rounded-2xl border border-[#d0d5cf] bg-[#dfe3de] text-xs text-[#4a5048]"
          >
            地図
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-lg font-bold">レビュー</h2>
            <span className="text-[11px] text-[#55524a]">閲覧のみ</span>
          </div>
          <p className="m-0 text-sm text-[#55524a]">まだレビューはありません（閲覧のみ）</p>
          <p className="m-0 text-xs leading-[1.7] text-[#55524a]">レビューは投稿者の意見で、WANDRARAが検証した事実ではありません。</p>
        </section>
      </div>
    </main>
  );
}
