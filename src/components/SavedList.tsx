"use client";

// 保存一覧の表示。サーバーで取った一覧を、画面全体の保存状態（詳細のシートなどで解除したものを含む）で絞る。
// 保存状態を読み終えるまでは、サーバーで取った一覧をそのまま出す
import Link from "next/link";
import type { SavedDestView } from "@/lib/saves-server";
import type { Photo } from "@/lib/types";
import { useSaves } from "./saves-context";

// 写真が無いときの色面（空と地面）
function placeholderStyle(photo: Photo | null) {
  const sky = photo?.placeholderSky ?? "#8f9692";
  const land = photo?.placeholderLand ?? "#2e322f";
  return { background: `linear-gradient(180deg, ${sky} 0%, ${sky} 56%, ${land} 56%, ${land} 100%)` };
}

export function SavedList({ items, emptyText }: { items: SavedDestView[]; emptyText: string }) {
  const { ready, isSaved } = useSaves();
  const shown = ready ? items.filter((it) => isSaved(it.destId)) : items;

  if (shown.length === 0) {
    return (
      <p data-testid="saved-empty" className="m-0 rounded-2xl bg-white p-4 text-[13px] leading-[1.7] text-[#55524a]">
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {shown.map((it) => (
        <li key={it.destId}>
          <Link
            href={it.href}
            data-testid="saved-item"
            className="flex items-center gap-3.5 rounded-2xl bg-white p-3 text-[#171717] no-underline"
          >
            {it.photo?.url && !it.photo.isDemo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.photo.url} alt="" loading="lazy" decoding="async" className="block size-16 flex-none rounded-[10px] object-cover" />
            ) : (
              <span className="block size-16 flex-none rounded-[10px]" style={placeholderStyle(it.photo)} />
            )}
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="truncate text-[15px] font-semibold">{it.title}</span>
              <span className="truncate text-[13px] text-[#55524a]">
                {[it.kindLabel, it.areaLabel].filter(Boolean).join("・")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
