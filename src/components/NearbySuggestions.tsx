import Image from "next/image";
import Link from "next/link";
import type { ComponentType, CSSProperties } from "react";
import type { Photo, Tile } from "@/lib/types";

// 近くの提案。何を出すか（tiles）と、どう見せるか（layout）を分ける。
// 見せ方を足すときは LAYOUTS に 1 つ足すだけ。呼ぶ側は tiles と title しか知らない。

export type NearbyLayout = "carousel";

type LayoutProps = { tiles: Tile[] };

// 写真が無いときのデモ用の色面（空と地面）
function placeholderStyle(photo: Photo | null): CSSProperties {
  const sky = photo?.placeholderSky ?? "#8f9692";
  const land = photo?.placeholderLand ?? "#2e322f";
  return { background: `linear-gradient(180deg, ${sky} 0%, ${sky} 56%, ${land} 56%, ${land} 100%)` };
}

// 横にスワイプして送る。3 枚目が少し覗く幅にして続きがあると分かるようにする
function NearbyCarousel({ tiles }: LayoutProps) {
  return (
    <div className="-mx-3 flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-px-3 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tiles.map((t, ti) => (
        <Link key={t.destId} href={t.href} prefetch={true} data-tile-dest-id={t.destId} data-tile-position={ti} className="flex w-[38%] shrink-0 snap-start flex-col gap-1.5 text-white no-underline">
          {t.photo?.url && !t.photo.isDemo ? (
            <Image src={t.photo.url} alt="" width={640} height={640} sizes="(max-width: 480px) 38vw, 182px" className="block aspect-square h-auto w-full rounded-[10px] object-cover" />
          ) : (
            <span className="block aspect-square w-full rounded-[10px]" style={placeholderStyle(t.photo)} />
          )}
          <span className="flex flex-col gap-0.5">
            <span className="text-xs leading-[1.4]">{t.label}</span>
            {t.sub && <span className="text-[11px] text-white/70">{t.sub}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}

const LAYOUTS: Record<NearbyLayout, ComponentType<LayoutProps>> = { carousel: NearbyCarousel };

export function NearbySuggestions({ title, tiles, layout = "carousel" }: { title: string; tiles: Tile[]; layout?: NearbyLayout }) {
  if (tiles.length === 0) return null;
  const Layout = LAYOUTS[layout];
  return (
    <section className="flex flex-col gap-2.5 px-3 pb-7 pt-3.5">
      <h2 className="m-0 text-xs font-semibold tracking-[0.04em] text-white/75">{title}</h2>
      <Layout tiles={tiles} />
    </section>
  );
}
