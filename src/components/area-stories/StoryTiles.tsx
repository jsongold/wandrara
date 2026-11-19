// story-tiles：ヘッダーの下に並ぶ項目のタイル（角丸の四角の写真に項目名を重ねる）。まだ見ていない項目は上端にアクセントの線
import type { MouseEvent } from "react";
import type { HighlightGroup, HighlightItem, HighlightKind } from "@/lib/area-highlights";
import { colorFill, ItemPhoto } from "./ItemPhoto";
import type { HighlightMessages } from "./types";

type Props = {
  groups: HighlightGroup[];
  seen: HighlightKind[];
  label: string;
  m: HighlightMessages;
  onOpen: (g: number, trigger: HTMLButtonElement) => void;
};

export function StoryTiles({ groups, seen, label, m, onOpen }: Props) {
  return (
    <>
      {/* ヘッダーからタイルの列まで、上から薄くなる影でつなぐ（帯の背景の段差を作らない） */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[180px]"
        style={{ background: "linear-gradient(to bottom, rgba(15,15,14,0.72) 0%, rgba(15,15,14,0.45) 55%, rgba(15,15,14,0) 100%)" }}
      />
      <nav
        aria-label={label}
        data-testid="area-stories"
        className="filter-mark-in absolute inset-x-0 top-[72px] z-[4] flex gap-2.5 overflow-x-auto px-4 pb-6 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((g, gi) => {
          const isSeen = seen.includes(g.kind);
          return (
            <button
              key={g.kind}
              type="button"
              onClick={(e: MouseEvent<HTMLButtonElement>) => onOpen(gi, e.currentTarget)}
              aria-label={m.open(m.kind[g.kind], g.items.length)}
              data-seen={isSeen}
              className="relative h-[64px] w-[64px] flex-none cursor-pointer overflow-hidden rounded-[14px] border-0 p-0 text-white transition-opacity"
              style={{ opacity: isSeen ? 0.6 : 1, boxShadow: "0 4px 14px rgba(0,0,0,0.35)" }}
            >
              <TileThumb items={g.items} />
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-8" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.7))" }} />
              <span className="absolute inset-x-0 bottom-1.5 text-center text-[11px] font-semibold leading-none">{m.kind[g.kind]}</span>
              {!isSeen && <span aria-hidden="true" className="absolute inset-x-3 top-0 h-[3px] rounded-b-sm bg-[#f4f1ea]" />}
            </button>
          );
        })}
      </nav>
    </>
  );
}

// タイルの絵。写真のある候補を優先し、無ければ 1 件目の頭文字を色面に出す
function TileThumb({ items }: { items: HighlightItem[] }) {
  const withPhoto = items.find((x) => x.photo);
  if (withPhoto) return <ItemPhoto item={withPhoto} className="absolute inset-0 h-full w-full" />;
  const first = items[0];
  return (
    <span aria-hidden="true" className="absolute inset-0 flex items-start justify-center pt-2.5 text-[20px] font-semibold text-white/85" style={colorFill(first.color)}>
      {first.name.slice(0, 1)}
    </span>
  );
}
