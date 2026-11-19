"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentType, CSSProperties } from "react";
import { areaHighlights, type HighlightGroup } from "@/lib/area-highlights";
import { useLocale, useMessages } from "@/lib/i18n/use-locale";
import { imageQuality } from "@/lib/save-data";
import type { CarouselItem, Photo, Tile } from "@/lib/types";
import { useSaveData, useSaveDataHint } from "@/lib/use-save-data";
import { colorFill, ItemPhoto } from "./area-stories/ItemPhoto";
import { useSeen } from "./area-stories/seen-store";

// 近くの提案。何を出すか（items。carousel の戦略が決める）と、どう見せるか（layout）を分ける。
// 見せ方を足すときは LAYOUTS に 1 つ足すだけ。呼ぶ側は items と title しか知らない。

export type NearbyLayout = "carousel";

// エリアの一言（Stories）の 1 枚を押したときに開く。areaLabel はその 1 枚に出すエリアの名前
export type StoriesOpener = { areaLabel: string; open: (area: string, trigger: HTMLElement) => void };

type LayoutProps = { items: CarouselItem[]; stories: StoriesOpener };

// 写真が無いときのデモ用の色面（空と地面）
function placeholderStyle(photo: Photo | null): CSSProperties {
  const sky = photo?.placeholderSky ?? "#8f9692";
  const land = photo?.placeholderLand ?? "#2e322f";
  return { background: `linear-gradient(180deg, ${sky} 0%, ${sky} 56%, ${land} 56%, ${land} 100%)` };
}

const TILE = "flex w-[38%] shrink-0 snap-start flex-col gap-1.5 text-white no-underline";

// saveData：通信量を抑えるときは詳細を先読みしない。quality：写真の画質（サーバーが決めた値に揃える）
function DestTile({ tile, position, saveData, quality }: { tile: Tile; position: number; saveData: boolean; quality: number }) {
  return (
    <Link href={tile.href} prefetch={!saveData} data-tile-dest-id={tile.destId} data-tile-position={position} className={TILE}>
      {tile.photo?.url && !tile.photo.isDemo ? (
        <Image src={tile.photo.url} alt="" width={640} height={640} sizes="(max-width: 480px) 38vw, 182px" quality={quality} className="block aspect-square h-auto w-full rounded-[10px] object-cover" />
      ) : (
        <span className="block aspect-square w-full rounded-[10px]" style={placeholderStyle(tile.photo)} />
      )}
      <span className="flex flex-col gap-0.5">
        <span className="text-xs leading-[1.4]">{tile.label}</span>
        {tile.sub && <span className="text-[11px] text-white/70">{tile.sub}</span>}
      </span>
    </Link>
  );
}

// エリアの一言をまとめた 1 枚。項目（名産・旬など）の 1 件目の写真か色面を、隙間なく 2×2 に並べる。まだ見ていない項目があれば右上に点
function StoriesTile({ area, position, stories }: { area: string; position: number; stories: StoriesOpener }) {
  const locale = useLocale();
  const m = useMessages().highlights;
  const groups = areaHighlights(area, locale);
  const seen = useSeen(area);
  if (groups.length === 0) return null;
  const unread = groups.some((g) => !seen.includes(g.kind));
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const title = m.tile(stories.areaLabel);
  return (
    <button
      type="button"
      data-stories-area={area}
      data-tile-position={position}
      data-testid="stories-tile"
      onClick={(e) => stories.open(area, e.currentTarget)}
      aria-label={`${title}（${m.tileSub(count)}）`}
      className={`${TILE} cursor-pointer border-0 bg-transparent p-0 text-left`}
    >
      <span aria-hidden="true" className="relative grid aspect-square w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-[10px] bg-[#1f2a27]">
        {groups.slice(0, 4).map((g) => (
          <StoriesCell key={g.kind} group={g} label={m.kind[g.kind]} />
        ))}
        {unread && <span data-testid="stories-tile-unread" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#f2a23a]" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-xs leading-[1.4]">{title}</span>
        <span className="text-[11px] text-white/70">{m.tileSub(count)}</span>
      </span>
    </button>
  );
}

function StoriesCell({ group, label }: { group: HighlightGroup; label: string }) {
  const item = group.items.find((x) => x.photo) ?? group.items[0];
  return (
    <span className="relative block overflow-hidden" style={item.photo ? undefined : colorFill(item.color)}>
      {item.photo && <ItemPhoto item={item} className="absolute inset-0 h-full w-full" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-black/60 pb-1 pt-3 text-center text-[10px] font-semibold leading-none">{label}</span>
    </span>
  );
}

// 横にスワイプして送る。3 枚目が少し覗く幅にして続きがあると分かるようにする
function NearbyCarousel({ items, stories }: LayoutProps) {
  const saveData = useSaveData(); // 通信量を抑えるときは、詳細を先読みせず、写真の画質を下げる（画質はサーバーが決めた値に揃える）
  const quality = imageQuality(useSaveDataHint());
  return (
    <div className="-mx-3 flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-px-3 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((x, i) =>
        x.type === "dest" ? (
          <DestTile key={x.tile.destId} tile={x.tile} position={i} saveData={saveData} quality={quality} />
        ) : (
          <StoriesTile key={`stories:${x.area}`} area={x.area} position={i} stories={stories} />
        ),
      )}
    </div>
  );
}

const LAYOUTS: Record<NearbyLayout, ComponentType<LayoutProps>> = { carousel: NearbyCarousel };

export function NearbySuggestions({ title, items, stories, layout = "carousel" }: { title: string; items: CarouselItem[]; stories: StoriesOpener; layout?: NearbyLayout }) {
  if (items.length === 0) return null;
  const Layout = LAYOUTS[layout];
  return (
    <section className="flex flex-col gap-2.5 px-3 pb-7 pt-3.5">
      <h2 className="m-0 text-xs font-semibold tracking-[0.04em] text-white/75">{title}</h2>
      <Layout items={items} stories={stories} />
    </section>
  );
}
